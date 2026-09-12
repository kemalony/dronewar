package dev.dronewar.rules

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

/**
 * config_parity (AC-1, AC-2).
 *
 * Every one of the golden dump's keys exists in the generated [Config], and every
 * numeric one is equal **bit for bit** -- `doubleToRawLongBits`, not `==` and
 * certainly not a tolerance. The golden dump stores raw IEEE-754 float64 patterns
 * precisely so that decimal formatting cannot quietly launder a one-ulp difference,
 * and a one-ulp difference in a spawn threshold is a diverged trace two seconds later.
 *
 * This test only reads android/harness/golden/config.json. Changing a Kotlin constant
 * without changing the web source it came from turns this red, which is the entire
 * point of pinning the port to a measurement instead of to a claim.
 */
class ConfigParityTest {

    private val golden: Map<String, Any?> by lazy {
        val path = System.getProperty("dronewar.golden.config")
            ?: error("system property dronewar.golden.config is not set (see :rules build.gradle.kts)")
        val file = File(path)
        assertTrue(file.isFile, "golden config not found at $path")
        @Suppress("UNCHECKED_CAST")
        (Json.parse(file.readText(Charsets.UTF_8)) as Map<String, Any?>)
    }

    @Suppress("UNCHECKED_CAST")
    private val goldenValues: Map<String, String>
        get() = golden["values"] as Map<String, String>

    @Test
    fun `every golden key exists exactly once in the generated config`() {
        val expectedCount = (golden["count"] as Double).toInt()
        assertEquals(expectedCount, goldenValues.size, "golden dump disagrees with its own count")

        val actual = ConfigIndex.ALL
        val missing = goldenValues.keys - actual.keys
        val extra = actual.keys - goldenValues.keys

        assertEquals(
            emptySet<String>(), missing,
            "${missing.size} golden keys have no generated constant (first few: ${missing.take(10)})",
        )
        assertEquals(
            emptySet<String>(), extra,
            "${extra.size} generated constants are not in the golden dump (first few: ${extra.take(10)})",
        )
        assertEquals(expectedCount, actual.size, "generated key count")
    }

    @Test
    fun `every numeric constant is bit-exact against the web dump`() {
        val actual = ConfigIndex.ALL
        val mismatches = ArrayList<String>()
        var doubles = 0
        var strings = 0
        var booleans = 0
        var lengths = 0

        for ((key, encoded) in goldenValues) {
            val value = actual[key]
            if (value == null) {
                mismatches += "$key: missing from generated Config"
                continue
            }
            when {
                encoded.startsWith("f64:") -> {
                    doubles++
                    val expectedBits = java.lang.Long.parseUnsignedLong(encoded.removePrefix("f64:0x"), 16)
                    if (value !is Double) {
                        mismatches += "$key: expected Double, got ${value.javaClass.simpleName} ($value)"
                    } else {
                        val actualBits = java.lang.Double.doubleToRawLongBits(value)
                        if (actualBits != expectedBits) {
                            mismatches += "$key: expected 0x%016x (%s), got 0x%016x (%s)".format(
                                expectedBits, java.lang.Double.longBitsToDouble(expectedBits), actualBits, value,
                            )
                        }
                    }
                }
                encoded.startsWith("s:") -> {
                    strings++
                    val expected = encoded.removePrefix("s:")
                    if (value != expected) mismatches += "$key: expected \"$expected\", got \"$value\""
                }
                encoded.startsWith("b:") -> {
                    booleans++
                    val expected = encoded.removePrefix("b:").toBoolean()
                    if (value != expected) mismatches += "$key: expected $expected, got $value"
                }
                encoded.startsWith("i:") -> {
                    lengths++
                    val expected = encoded.removePrefix("i:").toInt()
                    val asInt = (value as? Int) ?: (value as? Long)?.toInt()
                    if (asInt != expected) mismatches += "$key: expected length $expected, got $value"
                }
                else -> mismatches += "$key: unknown golden encoding '$encoded'"
            }
        }

        println(
            "config_parity: ${goldenValues.size} keys checked " +
                "($doubles float64 bit-exact, $strings strings, $booleans booleans, $lengths array lengths)"
        )
        assertTrue(
            mismatches.isEmpty(),
            "${mismatches.size} config parity mismatch(es):\n" + mismatches.take(25).joinToString("\n"),
        )
    }

    @Test
    fun `no constant was rounded to Float`() {
        // Float is banned in this module: JS has one number type and it is float64.
        // A Float here would silently round and make the later trace-parity gate
        // unreachable, so catch it as data even though the generator never emits it.
        val floats = ConfigIndex.ALL.filterValues { it is Float }.keys
        assertEquals(emptySet<String>(), floats, "constants stored as Float: $floats")
    }

    @Test
    fun `every owning web file contributed its keys`() {
        @Suppress("UNCHECKED_CAST")
        val owners = golden["owners"] as Map<String, String>
        val perFile = owners.values.groupingBy { it }.eachCount()
        assertEquals(
            mapOf(
                "src/core/CONFIG.js" to 456,
                "src/units/units.config.js" to 70,
                "src/audio/audio.config.js" to 30,
                "src/fx/fx.config.js" to 35,
                "src/game/game.config.js" to 5,
            ),
            perFile,
            "golden ownership split changed; regenerate config/*.toml with " +
                "tools/android/bootstrap_rules_config.py",
        )
        assertTrue(owners.keys.all { it in ConfigIndex.ALL }, "an owned key has no generated constant")
    }
}

/** Minimal JSON reader, so the parity gate has no third-party dependency to drift on. */
private object Json {

    fun parse(text: String): Any? {
        val p = Cursor(text)
        p.skipWs()
        val value = p.value()
        p.skipWs()
        require(p.i == text.length) { "trailing JSON at offset ${p.i}" }
        return value
    }

    private class Cursor(val s: String) {
        var i = 0

        fun skipWs() {
            while (i < s.length && s[i].isWhitespace()) i++
        }

        fun value(): Any? {
            return when (val c = s[i]) {
                '{' -> obj()
                '[' -> arr()
                '"' -> str()
                't' -> { expect("true"); true }
                'f' -> { expect("false"); false }
                'n' -> { expect("null"); null }
                else -> if (c == '-' || c.isDigit()) num() else error("unexpected '$c' at $i")
            }
        }

        fun obj(): LinkedHashMap<String, Any?> {
            val map = LinkedHashMap<String, Any?>()
            i++ // {
            skipWs()
            if (s[i] == '}') { i++; return map }
            while (true) {
                skipWs()
                val key = str()
                skipWs()
                require(s[i] == ':') { "expected ':' at $i" }
                i++
                skipWs()
                map[key] = value()
                skipWs()
                when (s[i]) {
                    ',' -> i++
                    '}' -> { i++; return map }
                    else -> error("expected ',' or '}' at $i")
                }
            }
        }

        fun arr(): ArrayList<Any?> {
            val list = ArrayList<Any?>()
            i++ // [
            skipWs()
            if (s[i] == ']') { i++; return list }
            while (true) {
                skipWs()
                list.add(value())
                skipWs()
                when (s[i]) {
                    ',' -> i++
                    ']' -> { i++; return list }
                    else -> error("expected ',' or ']' at $i")
                }
            }
        }

        fun str(): String {
            require(s[i] == '"') { "expected string at $i" }
            i++
            val sb = StringBuilder()
            while (true) {
                when (val c = s[i]) {
                    '"' -> { i++; return sb.toString() }
                    '\\' -> {
                        i++
                        when (val e = s[i]) {
                            '"' -> sb.append('"')
                            '\\' -> sb.append('\\')
                            '/' -> sb.append('/')
                            'b' -> sb.append('\b')
                            'f' -> sb.append('')
                            'n' -> sb.append('\n')
                            'r' -> sb.append('\r')
                            't' -> sb.append('\t')
                            'u' -> { sb.append(s.substring(i + 1, i + 5).toInt(16).toChar()); i += 4 }
                            else -> error("bad escape \\$e at $i")
                        }
                        i++
                    }
                    else -> { sb.append(c); i++ }
                }
            }
        }

        fun num(): Double {
            val start = i
            if (s[i] == '-' || s[i] == '+') i++
            while (i < s.length && (s[i].isDigit() || s[i] == '.' || s[i] == 'e' || s[i] == 'E' ||
                    ((s[i] == '-' || s[i] == '+') && (s[i - 1] == 'e' || s[i - 1] == 'E')))
            ) i++
            return s.substring(start, i).toDouble()
        }

        fun expect(literal: String) {
            require(s.startsWith(literal, i)) { "expected $literal at $i" }
            i += literal.length
        }
    }
}
