package dev.dronewar.sim

import dev.dronewar.rules.Config

/**
 * The facade `:harness` drives, and the only entry point outside this package.
 *
 * Invariants this class exists to hold:
 *
 *  - **No wall clock.** The sim sees `dt` and nothing else. [advance] takes the
 *    milliseconds it is given; it never asks the system what time it is.
 *  - **No allocation in the hot loop.** [Clock], [InputState] and [PlayerSim] are
 *    created once here; [advance] only reads and writes their fields.
 *  - **Frame rate is not sim rate.** One `advance(16.67)` and two `advance(8.33)`
 *    run the same number of sim steps and leave bit-identical state.
 *
 * `startGame()` in the web build starts the player at `x = W/2`, `y = H*0.78` with
 * a zeroed accumulator, which is what the constructor and [reset] reproduce.
 */
public class Sim(seed: Int = 0, droneId: String = PlayerSim.DEFAULT_DRONE) {

    private val clock = Clock(Config.SIM_HZ)
    private val input = InputState()
    private val player = PlayerSim(droneId)

    /** Named RNG streams all draw from here. Nothing in the player-only trace does. */
    @JvmField
    public val rng: Lcg = Lcg(seed)

    /** Total sim steps run since construction or [reset]. Read-only from outside. */
    public var steps: Long = 0L
        private set

    public fun press(key: Key) {
        input.press(key)
    }

    public fun release(key: Key) {
        input.release(key)
    }

    /** Advances by `rawMs` milliseconds; returns the number of sim steps run. */
    public fun advance(rawMs: Double): Int {
        val n = clock.advance(rawMs)
        var i = 0
        while (i < n) {
            step()
            i++
        }
        return n
    }

    /** Exactly one sim step at the fixed `dt`. `Game._simStep(this.clock.step)`. */
    public fun step() {
        input.refreshAxis()
        player.update(clock.step, input.ax, input.ay)
        steps++
    }

    /** Back to the `startGame()` state: player at spawn, clock and input clear. */
    public fun reset(seed: Int = 0) {
        clock.reset()
        input.clear()
        player.reset()
        rng.reseed(seed)
        steps = 0L
    }

    /** Seconds per sim step -- `:harness` drives ticks in multiples of this. */
    public val stepSeconds: Double get() = clock.step

    /** Draw interpolation factor, 0..1. Always 0 when ticks are whole steps. */
    public val alpha: Double get() = clock.alpha

    public val playerX: Double get() = player.x
    public val playerY: Double get() = player.y
    public val playerVx: Double get() = player.vx
    public val playerVy: Double get() = player.vy
}
