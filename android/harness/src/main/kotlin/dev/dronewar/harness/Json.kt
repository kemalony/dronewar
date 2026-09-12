package dev.dronewar.harness

/**
 * Minimal JSON reader, so the parity gate has no third-party dependency to drift on
 * -- the same reasoning (and the same shape) as :rules' ConfigParityTest.
 *
 * Numbers arrive as [Double] and strings as [String]; that is all the trace header
 * and its rows contain. The float64 payloads are *not* JSON numbers -- they are
 * `"f64:0x…"` strings, decoded by [F64], precisely so that no JSON parser anywhere in
 * the pipeline gets a chance to reformat the bits this gate exists to compare.
 */
internal object Json {

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
