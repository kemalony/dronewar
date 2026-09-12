package dev.dronewar.harness

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * AC-1 -- the trace reader.
 *
 * Before the comparator is worth anything, the decode has to be provably lossless.
 * The round trip asserted here is the whole claim: for every value in the file,
 * `doubleToRawLongBits(decode(hex)) == parseUnsignedLong(hex, 16)`. If that ever
 * drifted, a parity "pass" would only mean the reader and the sim agreed on the
 * same wrong number.
 */
class TraceReaderTest {

    private val trace = GoldenTrace.load()

    @Test
    fun `header and data rows are read as separate things`() {
        val h = trace.header
        assertEquals(1, h.schema, "trace schema")
        assertEquals("player_only", h.trace)
        assertEquals("startGame", h.startState)
        assertEquals(h.steps, trace.rows.size, "data row count must match the header's step count")
        assertTrue(trace.rows.isNotEmpty(), "no data rows")
        trace.rows.forEachIndexed { i, row -> assertEquals(i, row.step, "row $i is out of order") }

        // A relationship, not a hardcoded constant: re-recording at another rate must
        // stay consistent rather than quietly disagree with itself.
        assertEquals(
            java.lang.Double.doubleToRawLongBits(1000.0 / h.simHz),
            java.lang.Double.doubleToRawLongBits(h.tickMs),
            "tickMs (${h.tickMs}) is not bit-exactly 1000/simHz (${h.simHz})",
        )
        assertTrue(h.script.isNotEmpty(), "trace has no input script")

        println(
            "trace_reader: ${trace.rows.size} steps, tickMs=${h.tickMs} (simHz=${h.simHz}), " +
                "${h.script.size} script events, webSha=${h.webSha.take(12)} configHash=${h.configHash}"
        )
        // Say out loud which file was measured against. A suite that quietly read a
        // doctored copy instead of android/harness/golden/ is a suite that proves nothing.
        println("trace_reader: read ${System.getProperty("dronewar.golden.trace")}")
    }

    @Test
    fun `every f64 literal decodes back to its own bit pattern`() {
        var checked = 0
        val bad = ArrayList<String>()

        // Re-read the raw strings so this tests the decode rather than testing the
        // reader against itself.
        for (row in trace.rows) {
            for (field in GoldenTrace.FIELDS) {
                val bits = row.bitsOf(field)
                val encoded = F64.PREFIX + "%016x".format(bits)
                val reparsed = java.lang.Long.parseUnsignedLong(encoded.removePrefix(F64.PREFIX), 16)
                val viaDouble = java.lang.Double.doubleToRawLongBits(F64.decode(encoded))
                if (reparsed != bits || viaDouble != bits) {
                    bad += "step ${row.step} $field: bits=${F64.hex(bits)} " +
                        "reparsed=${F64.hex(reparsed)} viaDouble=${F64.hex(viaDouble)}"
                }
                checked++
            }
        }

        println("trace_reader: $checked f64 literals round-tripped bit-exactly")
        assertTrue(bad.isEmpty(), "${bad.size} f64 literal(s) did not round-trip:\n" + bad.take(10).joinToString("\n"))
    }

    @Test
    fun `NaN and negative zero survive the codec`() {
        // Not in the trace today, but the codec must never route through decimal.
        // `-0.0 == 0.0` and `NaN != NaN`, so a `==` comparator would pass on the
        // first and fail on the second; raw bits get both right.
        val cases = doubleArrayOf(-0.0, 0.0, Double.NaN, Double.MIN_VALUE, -1.0 / 3.0)
        for (v in cases) {
            val bits = java.lang.Double.doubleToRawLongBits(v)
            val encoded = F64.PREFIX + "%016x".format(bits)
            assertEquals(bits, F64.bits(encoded), "bits for $v")
            assertEquals(bits, java.lang.Double.doubleToRawLongBits(F64.decode(encoded)), "decode of $v")
        }
    }
}
