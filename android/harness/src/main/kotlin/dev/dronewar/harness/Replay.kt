package dev.dronewar.harness

import dev.dronewar.sim.Sim

/** Player state sampled after a completed sim step. Raw bits are the payload. */
class Sample(
    val step: Int,
    val x: Double,
    val y: Double,
    val vx: Double,
    val vy: Double,
) {
    fun bitsOf(field: String): Long = java.lang.Double.doubleToRawLongBits(
        when (field) {
            "x" -> x
            "y" -> y
            "vx" -> vx
            "vy" -> vy
            else -> throw IllegalArgumentException("no such field '$field'")
        }
    )

    fun valueOf(field: String): Double = when (field) {
        "x" -> x
        "y" -> y
        "vx" -> vx
        "vy" -> vy
        else -> throw IllegalArgumentException("no such field '$field'")
    }
}

/**
 * The outcome of one replay: the samples, plus how many sim steps actually ran.
 *
 * [totalSteps] is summed from what `advance()` *returned*, not from how many ticks
 * were issued. The determinism claim is precisely that this number does not move
 * when the frame rate does, so it must be measured rather than assumed.
 */
class ReplayResult(
    val stepsPerTick: Int,
    val tickMs: Double,
    val ticks: Int,
    val totalSteps: Int,
    val samples: List<Sample>,
) {
    /** step index -> sample. Run at 2 steps/tick this is sparse: only odd indices. */
    val byStep: Map<Int, Sample> = LinkedHashMap<Int, Sample>(samples.size * 2).also { m ->
        for (s in samples) m[s.step] = s
    }
}

/**
 * Drives [Sim] through a golden trace's input script.
 *
 * The loop is indexed by SIM STEP, not by wall clock. tools/record_trace.py recorded
 * the web reference the same way, and its docstring says why: `Clock.advance(ms)`
 * runs a whole number of steps out of an accumulator, so driving by frames instead
 * runs a *different number of steps* at a different frame rate and produces a parity
 * failure that is an artifact of the driver rather than a fact about the port.
 * tools/evaluate.py's `scenario_positions` carries the scar: a naive same-frame-count
 * comparison reported a fake 191px "determinism failure".
 *
 * Per step i, in this exact order:
 *   1. apply every `script[]` event whose `step == i`
 *   2. `advance(tickMs)` once
 *   3. sample the player state
 *
 * [stepsPerTick] > 1 folds several sim steps into one `advance()` call -- the same
 * total number of sim steps, delivered in fewer, larger ticks. That is the honest
 * way to change the frame rate without changing the simulation.
 */
class Replay(
    private val header: TraceHeader,
    private val stepsPerTick: Int = 1,
) {

    init {
        require(stepsPerTick >= 1) { "stepsPerTick must be >= 1, got $stepsPerTick" }
        require(header.steps % stepsPerTick == 0) {
            "trace has ${header.steps} steps, which is not a whole number of $stepsPerTick-step ticks; " +
                "a partial last tick would sample a different step index in each run"
        }
        // An event keyed to a step in the middle of a tick cannot be delivered on
        // time -- a tick is atomic. Rather than quietly firing it one step early
        // (which would look like a sim bug in the parity report), refuse the run.
        val offenders = header.script.filter { it.step % stepsPerTick != 0 }
        require(offenders.isEmpty()) {
            "at $stepsPerTick steps/tick these script events do not land on a tick boundary and " +
                "cannot be delivered at their recorded sim step: $offenders"
        }
    }

    /** Events grouped by the sim step index they fire at. */
    private val byStep: Map<Int, List<ScriptEvent>> = header.script.groupBy { it.step }

    fun run(sim: Sim = Sim()): ReplayResult {
        val tickMs = header.tickMs * stepsPerTick
        val ticks = header.steps / stepsPerTick
        val samples = ArrayList<Sample>(ticks)
        var executed = 0

        for (t in 0 until ticks) {
            val firstStep = t * stepsPerTick
            // Input transitions are keyed to sim step index. Every event belonging to
            // a step this tick is about to run is applied before the tick, which is
            // exactly what the recorder did at 1 step/tick.
            for (s in firstStep until firstStep + stepsPerTick) {
                val events = byStep[s] ?: continue
                for (e in events) e.applyTo(sim)
            }

            val ran = sim.advance(tickMs)
            executed += ran
            if (ran > 0) {
                samples.add(Sample(executed - 1, sim.playerX, sim.playerY, sim.playerVx, sim.playerVy))
            }
        }

        return ReplayResult(
            stepsPerTick = stepsPerTick,
            tickMs = tickMs,
            ticks = ticks,
            totalSteps = executed,
            samples = samples,
        )
    }
}
