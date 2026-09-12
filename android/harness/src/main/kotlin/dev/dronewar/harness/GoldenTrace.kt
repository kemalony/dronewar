package dev.dronewar.harness

import dev.dronewar.sim.Key
import dev.dronewar.sim.Sim
import java.io.File
import java.util.zip.GZIPInputStream

/**
 * Raw IEEE-754 float64 codec for the `f64:0x<16 hex digits>` encoding the golden
 * trace and the golden config both use.
 *
 * Decimal is never an intermediate form here. `480.0765432098765` is a lossy
 * rendering of a bit pattern, and a one-ulp difference -- the exact thing the parity
 * gate exists to catch -- is invisible in decimal but obvious in hex.
 */
object F64 {

    const val PREFIX: String = "f64:0x"
    const val HEX_DIGITS: Int = 16

    /** The literal's raw bits, unchanged. No `toDouble()` anywhere on this path. */
    fun bits(encoded: String): Long {
        require(encoded.startsWith(PREFIX)) { "not an f64 literal: '$encoded'" }
        val hex = encoded.substring(PREFIX.length)
        require(hex.length == HEX_DIGITS) {
            "f64 literal needs $HEX_DIGITS hex digits, got ${hex.length}: '$encoded'"
        }
        return java.lang.Long.parseUnsignedLong(hex, 16)
    }

    fun decode(encoded: String): Double = java.lang.Double.longBitsToDouble(bits(encoded))

    fun hex(bits: Long): String = "0x%016x".format(bits)

    fun hexOf(value: Double): String = hex(java.lang.Double.doubleToRawLongBits(value))
}

/** One `press`/`release` transition, keyed to a SIM STEP INDEX -- never to elapsed time. */
class ScriptEvent(val step: Int, val action: String, val key: String) {

    val simKey: Key = when (key.lowercase()) {
        "left" -> Key.LEFT
        "right" -> Key.RIGHT
        "up" -> Key.UP
        "down" -> Key.DOWN
        else -> throw IllegalArgumentException(
            "trace script uses key '$key' at step $step, which dev.dronewar.sim.Key does not have"
        )
    }

    fun applyTo(sim: Sim) {
        when (action) {
            "press" -> sim.press(simKey)
            "release" -> sim.release(simKey)
            else -> throw IllegalArgumentException("unknown script action '$action' at step $step")
        }
    }

    override fun toString(): String = "step $step: $action $key"
}

/** Line 1 of the NDJSON: everything needed to reproduce the run. */
class TraceHeader(
    val schema: Int,
    val trace: String,
    val webSha: String,
    val configHash: String,
    val simHz: Double,
    val tickMs: Double,
    val steps: Int,
    val startState: String,
    val drone: String,
    val script: List<ScriptEvent>,
)

/**
 * One recorded step. Bits are the payload; the [x]/[y]/[vx]/[vy] doubles are derived
 * views for human-readable failure text, never for comparison.
 */
class TraceRow(
    val step: Int,
    val xBits: Long,
    val yBits: Long,
    val vxBits: Long,
    val vyBits: Long,
) {
    val x: Double get() = java.lang.Double.longBitsToDouble(xBits)
    val y: Double get() = java.lang.Double.longBitsToDouble(yBits)
    val vx: Double get() = java.lang.Double.longBitsToDouble(vxBits)
    val vy: Double get() = java.lang.Double.longBitsToDouble(vyBits)

    fun bitsOf(field: String): Long = when (field) {
        "x" -> xBits
        "y" -> yBits
        "vx" -> vxBits
        "vy" -> vyBits
        else -> throw IllegalArgumentException("no such field '$field'")
    }
}

/**
 * The golden trace: the web build, driven one sim step at a time in a real browser,
 * with every step's player state written as raw float64 bits. See tools/record_trace.py.
 *
 * This class only ever reads. android/harness/golden/ is the ruler; a harness that
 * edits its own reference to go green is worse than no harness at all.
 */
class GoldenTrace(val header: TraceHeader, val rows: List<TraceRow>) {

    companion object {

        /** The four sampled player fields, in a fixed order so failure text is stable. */
        @JvmField
        val FIELDS: Array<String> = arrayOf("x", "y", "vx", "vy")

        /** Reads the path in `-Ddronewar.golden.trace` (set by :harness build.gradle.kts). */
        fun load(): GoldenTrace {
            val path = System.getProperty("dronewar.golden.trace")
                ?: error("system property dronewar.golden.trace is not set (see :harness build.gradle.kts)")
            val file = File(path)
            require(file.isFile) { "golden trace not found at $path" }
            return read(file)
        }

        fun read(file: File): GoldenTrace {
            val lines = GZIPInputStream(file.inputStream().buffered())
                .reader(Charsets.UTF_8)
                .useLines { seq -> seq.filter { it.isNotBlank() }.toList() }
            require(lines.size >= 2) { "$file: expected a header line and at least one data row, got ${lines.size}" }

            val header = parseHeader(lines[0], file)
            val rows = ArrayList<TraceRow>(lines.size - 1)
            for (i in 1 until lines.size) {
                @Suppress("UNCHECKED_CAST")
                val o = Json.parse(lines[i]) as Map<String, Any?>
                val step = (o["step"] as Double).toInt()
                require(step == i - 1) { "$file line ${i + 1}: expected step ${i - 1}, got $step" }
                rows.add(
                    TraceRow(
                        step = step,
                        xBits = F64.bits(o["x"] as String),
                        yBits = F64.bits(o["y"] as String),
                        vxBits = F64.bits(o["vx"] as String),
                        vyBits = F64.bits(o["vy"] as String),
                    )
                )
            }
            require(rows.size == header.steps) {
                "$file: header says ${header.steps} steps, file has ${rows.size} data rows"
            }
            return GoldenTrace(header, rows)
        }

        private fun parseHeader(line: String, file: File): TraceHeader {
            @Suppress("UNCHECKED_CAST")
            val h = Json.parse(line) as Map<String, Any?>
            val schema = (h["schema"] as Double).toInt()
            require(schema == 1) { "$file: unsupported trace schema $schema" }

            @Suppress("UNCHECKED_CAST")
            val script = (h["script"] as List<Any?>).map { raw ->
                @Suppress("UNCHECKED_CAST")
                val e = raw as Map<String, Any?>
                ScriptEvent(
                    step = (e["step"] as Double).toInt(),
                    action = e["action"] as String,
                    key = e["key"] as String,
                )
            }
            return TraceHeader(
                schema = schema,
                trace = h["trace"] as String,
                webSha = h["webSha"] as String,
                configHash = h["configHash"] as String,
                simHz = h["simHz"] as Double,
                // tickMs is a JSON number, but 1000/120 has an exact shortest-decimal
                // round trip, so parsing it back is bit-exact. The gate would notice
                // if it were not: a mistimed tick diverges within a handful of steps.
                tickMs = h["tickMs"] as Double,
                steps = (h["steps"] as Double).toInt(),
                startState = h["startState"] as String,
                drone = h["drone"] as String,
                script = script,
            )
        }
    }
}
