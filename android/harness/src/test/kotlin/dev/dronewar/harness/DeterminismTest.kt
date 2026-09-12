package dev.dronewar.harness

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * determinism (AC-5).
 *
 * The same input script, driven at 1 sim step per tick and at 2 sim steps per tick.
 * Per *step index*, the player state must be bit-identical. The frame rate changes;
 * the number of sim steps must not.
 *
 * The comparison is by step index and never by tick index, which is the whole trick.
 * tools/evaluate.py's `scenario_positions` documents what the naive version costs:
 * comparing the same *frame count* at two frame rates runs a different number of sim
 * steps in each run (16.67ms -> 2 steps/frame, 6.94ms -> 1 step/frame), so frame 200
 * of one run is a different moment in simulated time than frame 200 of the other.
 * That produced a 191px "determinism failure" that said nothing about determinism.
 *
 * Input transitions are keyed to sim step index too, for the same reason.
 */
class DeterminismTest {

    private val trace = GoldenTrace.load()

    @Test
    fun `1 and 2 sim steps per tick produce bit-identical state per step index`() {
        val slow = Replay(trace.header, stepsPerTick = 1).run()
        val fast = Replay(trace.header, stepsPerTick = 2).run()

        // Claim one: the frame rate changed, the step budget did not.
        assertEquals(
            trace.header.steps, slow.totalSteps,
            "1 step/tick ran ${slow.totalSteps} sim steps over ${slow.ticks} ticks of ${slow.tickMs}ms",
        )
        assertEquals(
            slow.totalSteps, fast.totalSteps,
            "2 steps/tick ran ${fast.totalSteps} sim steps over ${fast.ticks} ticks of ${fast.tickMs}ms, " +
                "but 1 step/tick ran ${slow.totalSteps}. Same script, same number of sim steps -- " +
                "if these differ, the accumulator is leaking wall-clock into the simulation.",
        )
        assertEquals(
            slow.ticks / 2, fast.ticks,
            "the two runs should differ in tick count (that is the point of the test)",
        )

        // Claim two: at every step index both runs sampled, the state is the same bits.
        // The 2 steps/tick run only samples at odd step indices -- a tick is atomic,
        // so the state in the middle of one is not observable. Comparing the overlap
        // is the honest comparison; padding it with interpolated values would not be.
        val mismatches = ArrayList<String>()
        var compared = 0
        var fields = 0

        for (f in fast.samples) {
            val s = slow.byStep[f.step] ?: continue
            compared++
            for (field in GoldenTrace.FIELDS) {
                fields++
                val slowBits = s.bitsOf(field)
                val fastBits = f.bitsOf(field)
                if (slowBits != fastBits) {
                    mismatches += "step ${f.step} $field: 1 step/tick ${F64.hex(slowBits)} " +
                        "(${s.valueOf(field)}), 2 steps/tick ${F64.hex(fastBits)} (${f.valueOf(field)}) " +
                        "[bit delta ${fastBits - slowBits}]"
                }
            }
        }

        println(
            "determinism: ${slow.totalSteps} sim steps at ${slow.tickMs}ms/tick and " +
                "${fast.totalSteps} at ${fast.tickMs}ms/tick; $compared shared step indices, " +
                "$fields field comparisons, ${mismatches.size} mismatch(es)"
        )

        assertEquals(
            trace.header.steps / 2, compared,
            "expected every odd step index to be shared between the two runs",
        )
        if (mismatches.isNotEmpty()) {
            println("determinism: FIRST DIVERGENCE -> ${mismatches.first()}")
        }
        assertTrue(
            mismatches.isEmpty(),
            "${mismatches.size} determinism mismatch(es); first divergence:\n" +
                mismatches.take(8).joinToString("\n"),
        )
    }

    @Test
    fun `replaying the same script twice is bit-identical`() {
        // Two fresh Sims, same script. Anything that leaks in from outside the sim --
        // a static accumulator, a time source, an iteration order over a HashMap --
        // shows up here and nowhere else.
        val a = Replay(trace.header, stepsPerTick = 1).run()
        val b = Replay(trace.header, stepsPerTick = 1).run()

        assertEquals(a.totalSteps, b.totalSteps, "two identical runs ran a different number of steps")
        val mismatches = ArrayList<String>()
        for (i in a.samples.indices) {
            for (field in GoldenTrace.FIELDS) {
                val x = a.samples[i].bitsOf(field)
                val y = b.samples[i].bitsOf(field)
                if (x != y) {
                    mismatches += "step ${a.samples[i].step} $field: run A ${F64.hex(x)}, run B ${F64.hex(y)}"
                }
            }
        }
        println("determinism: repeat run over ${a.totalSteps} steps, ${mismatches.size} mismatch(es)")
        assertTrue(mismatches.isEmpty(), "the sim is not reproducible run to run:\n" + mismatches.take(8).joinToString("\n"))
    }
}
