package dev.dronewar.sim

import dev.dronewar.rules.Config

/**
 * Fixed-step accumulator, ported from `src/core/Clock.js`.
 *
 * ```js
 * advance(rawDtMs) {
 *   let dt = Math.min(rawDtMs / 1000, CONFIG.MAX_DT);
 *   this.acc += dt;
 *   let n = 0;
 *   while (this.acc >= this.step - 1e-9) { this.acc -= this.step; n++; }
 *   return { steps: n, alpha: this.acc / this.step };
 * }
 * ```
 *
 * The `1e-9` is load-bearing, not slop: at 60 Hz with a 120 Hz sim the accumulator
 * lands a few ulp short of a whole step, and without the epsilon every other frame
 * runs one step too few. Dropping it changes the step count, which changes the trace.
 *
 * The JS version allocates a `{steps, alpha}` object per call. Here [advance] returns
 * the step count and [alpha] is a property, so the hot loop allocates nothing.
 */
public class Clock(hz: Double = Config.SIM_HZ) {

    /** Seconds per simulation step; the `dt` every sim step is driven with. */
    @JvmField
    public val step: Double = 1.0 / hz

    /** Unconsumed time, in seconds. */
    @JvmField
    public var acc: Double = 0.0

    /** Interpolation factor for drawing, 0..1. Always 0 when ticks are whole steps. */
    public val alpha: Double
        get() = acc / step

    /** Advances by `rawDtMs` milliseconds and returns how many sim steps to run. */
    public fun advance(rawDtMs: Double): Int {
        val dt = JsMath.min(rawDtMs / 1000.0, Config.MAX_DT)
        acc += dt
        var n = 0
        while (acc >= step - 1e-9) {
            acc -= step
            n++
        }
        return n
    }

    /** `Game.startGame()` zeroes the accumulator so a stale remainder cannot shift the sim. */
    public fun reset() {
        acc = 0.0
    }
}
