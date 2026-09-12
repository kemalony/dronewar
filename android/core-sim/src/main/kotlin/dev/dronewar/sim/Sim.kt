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
        if (touchActive) {
            // `Player.update()` takes the touch branch whenever the pointer is live;
            // the keyboard axis is not even read there. Note it does NOT `return`
            // afterwards on the web -- doing that once killed firing outright.
            player.updateTouch(clock.step, baseX + touchDX, baseY + touchDY)
        } else {
            input.refreshAxis()
            player.update(clock.step, input.ax, input.ay)
        }
        steps++
    }

    // ---------------------------------------------------------------- touch ----
    //
    // 1:1 *relative* finger tracking, ported from `src/input/Input.js`. The drone
    // does not fly to the finger: it slides by however far the finger has slid since
    // it went down, so the finger never covers the drone and aiming stays exact.
    //
    // `touchActive` is the Kotlin spelling of `_activePointer == null`. It starts
    // false and every guard tests it, because on the web the field was once left
    // undefined and a single stray move read `_originX` as undefined, turned
    // `touchDX` into NaN and put the player at NaN.
    //
    // Debt, stated: this branch has no golden trace yet. The keyboard branch that
    // `gate_core_sim.sh` drives runs only when `touchActive` is false, which it is
    // for the whole of that trace.

    private var touchActive: Boolean = false
    private var originX: Double = 0.0
    private var originY: Double = 0.0
    private var baseX: Double = 0.0
    private var baseY: Double = 0.0
    private var touchDX: Double = 0.0
    private var touchDY: Double = 0.0

    /**
     * Finger position in 480x800 internal coordinates. The first call after a
     * release starts a new gesture: the origin is where the finger landed and the
     * base is where the drone already is, so the drone does not jump.
     */
    public fun touchMove(x: Double, y: Double) {
        if (!touchActive) {
            touchActive = true
            originX = x
            originY = y
            baseX = player.x
            baseY = player.y
        }
        touchDX = x - originX
        touchDY = y - originY
    }

    /** Finger lifted. The next [touchMove] rebases against the drone's new position. */
    public fun touchRelease() {
        touchActive = false
        touchDX = 0.0
        touchDY = 0.0
    }

    /** True while a finger is being tracked -- the auto-fire condition. */
    public val touching: Boolean get() = touchActive

    /** Back to the `startGame()` state: player at spawn, clock and input clear. */
    public fun reset(seed: Int = 0) {
        clock.reset()
        input.clear()
        player.reset()
        touchRelease()
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
