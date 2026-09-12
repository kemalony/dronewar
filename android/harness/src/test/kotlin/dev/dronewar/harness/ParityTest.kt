package dev.dronewar.harness

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * parity (AC-2, AC-3, AC-4) -- the gate the whole port is measured by.
 *
 * All 720 recorded steps, all four player fields, compared with
 * `java.lang.Double.doubleToRawLongBits`. Raw bits: not `==`, and under no
 * circumstances a tolerance. A `1e-9` epsilon would make this file decoration --
 * it would pass a sim that is one ulp off on step 1 and 40 pixels off by step 700,
 * because the error it hides is the seed of the error it is supposed to catch.
 *
 * A failure names the step index, the field, and both values in hex, so one run
 * localises the fork instead of starting a bisect.
 */
class ParityTest {

    private val trace = GoldenTrace.load()

    @Test
    fun `the Kotlin sim reproduces the web golden trace with zero bit difference`() {
        val result = Replay(trace.header, stepsPerTick = 1).run()

        // The step budget is part of parity. A sim that runs 719 or 721 steps has
        // already diverged, whatever the positions say.
        assertEquals(
            trace.header.steps, result.totalSteps,
            "advance() reported ${result.totalSteps} sim steps over ${result.ticks} ticks of " +
                "${result.tickMs}ms; the trace records ${trace.header.steps}",
        )
        assertEquals(
            trace.rows.size, result.samples.size,
            "sampled ${result.samples.size} steps, trace has ${trace.rows.size}",
        )

        val mismatches = ArrayList<String>()
        var fields = 0

        for (row in trace.rows) {
            val sample = result.samples[row.step]
            if (sample.step != row.step) {
                mismatches += "step ${row.step}: sample is misaligned (sampled step ${sample.step})"
                continue
            }
            for (field in GoldenTrace.FIELDS) {
                fields++
                val expectedBits = row.bitsOf(field)
                val actualBits = sample.bitsOf(field)
                if (expectedBits != actualBits) {
                    mismatches += describe(row.step, field, expectedBits, actualBits, sample.valueOf(field))
                }
            }
        }

        println(
            "parity: ${trace.rows.size}/${trace.header.steps} steps checked, " +
                "$fields field comparisons (${GoldenTrace.FIELDS.joinToString(",")}) via doubleToRawLongBits, " +
                "${mismatches.size} mismatch(es) " +
                "[webSha=${trace.header.webSha.take(12)} configHash=${trace.header.configHash}]"
        )

        if (mismatches.isNotEmpty()) {
            // The first line is the one that matters: everything after the fork is
            // downstream of it, so print it first and print it loudly.
            println("parity: FIRST DIVERGENCE -> ${mismatches.first()}")
        }
        assertTrue(
            mismatches.isEmpty(),
            "${mismatches.size} parity mismatch(es) over ${trace.rows.size} steps; first divergence:\n" +
                mismatches.take(8).joinToString("\n") +
                if (mismatches.size > 8) "\n... and ${mismatches.size - 8} more" else "",
        )
    }

    /** `step 360 x: expected 0x… (480.076…), got 0x… (480.076…)` -- hex first, always. */
    private fun describe(step: Int, field: String, expectedBits: Long, actualBits: Long, actual: Double): String {
        val expected = java.lang.Double.longBitsToDouble(expectedBits)
        val ulps = actualBits - expectedBits
        return "step $step $field: expected ${F64.hex(expectedBits)} ($expected), " +
            "got ${F64.hex(actualBits)} ($actual) [bit delta $ulps]"
    }
}
