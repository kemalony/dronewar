package dev.dronewar.sim

import dev.dronewar.rules.Config

/**
 * The player drone, ported from the **keyboard branch** of `Player.update()`
 * (`src/units/Player.js:91`).
 *
 * R1 phase 1 deliberately stops at movement. The touch branch, dash, sub-drones,
 * heat, firing, lives, invincibility and the draw-only tilt/trail are not here,
 * because the golden trace contains none of them; porting them unmeasured would be
 * porting them untested.
 *
 * What remains is the movement pipeline, in the web's order -- the order is part of
 * the result, since each stage reads what the last one wrote:
 *
 *  1. accelerate along the axis, or decay exponentially when no key is held
 *  2. clamp the speed to the drone's maximum
 *  3. integrate position
 *  4. clamp to the screen, zeroing the velocity on the axis that touched
 */
public class PlayerSim(droneId: String = DEFAULT_DRONE) {

    public val droneId: String = droneId

    /** `D.speed` from the drone table. */
    @JvmField
    public val maxSpeed: Double = speedOf(droneId)

    /** `D.hitboxMul || 1` -- only `tank` overrides it. */
    @JvmField
    public val hitboxMul: Double = hitboxMulOf(droneId)

    @JvmField
    public var x: Double = 0.0

    @JvmField
    public var y: Double = 0.0

    @JvmField
    public var vx: Double = 0.0

    @JvmField
    public var vy: Double = 0.0

    init {
        reset()
    }

    /** The constructor's starting state: `x = W/2`, `y = H*0.78`, at rest. */
    public fun reset() {
        x = Config.W / 2.0
        y = Config.H * 0.78
        vx = 0.0
        vy = 0.0
    }

    /** `hitR()` -- the clamp radius, which is the hitbox radius, not the sprite half. */
    public fun hitR(): Double = Config.PLAYER.half * hitboxMul

    /**
     * One simulation step. [ax]/[ay] come from [InputState.refreshAxis].
     *
     * Allocation-free: primitives in, fields out, no temporaries that escape.
     */
    public fun update(dt: Double, ax: Double, ay: Double) {
        val hasInput = ax != 0.0 || ay != 0.0

        if (hasInput) {
            vx += ax * Config.PLAYER.accel * dt
            vy += ay * Config.PLAYER.accel * dt
        } else {
            // Exponential decay, half-life 0.12 s. This `pow` is the single call the
            // whole StrictMath rule exists for: `Math.pow` is intrinsified on HotSpot
            // and may differ from V8's fdlibm in the last ulp, and that ulp compounds
            // step over step until the trace forks.
            val f = JsMath.pow(0.5, dt / Config.PLAYER.decayHalfLife)
            vx *= f
            vy *= f
            // Snap to rest below half a pixel per second, so a released key settles
            // at exact zero instead of an asymptotic tail. Without it, ±0 parity and
            // the resting position both drift.
            if (JsMath.abs(vx) < 0.5) vx = 0.0
            if (JsMath.abs(vy) < 0.5) vy = 0.0
        }

        // Max speed. `JsMath.hypot` is V8's algorithm, not fdlibm's -- see JsMath.
        val sp = JsMath.hypot(vx, vy)
        if (sp > maxSpeed) {
            val k = maxSpeed / sp
            vx *= k
            vy *= k
        }

        // Integrate.
        x += vx * dt
        y += vy * dt

        // Screen clamp. Four independent `if`s, not if/else-if, and the velocity is
        // zeroed unconditionally -- that is what the web source does on this path,
        // and it differs from the `_clamp()` helper the touch branch uses.
        val h = hitR()
        if (x < h) { x = h; vx = 0.0 }
        if (x > Config.W - h) { x = Config.W - h; vx = 0.0 }
        if (y < h) { y = h; vy = 0.0 }
        if (y > Config.H - h) { y = Config.H - h; vy = 0.0 }
    }

    /**
     * One simulation step on the **touch branch** (`src/units/Player.js:99-110`).
     *
     * This is not the keyboard integrator with a different input: the web source
     * disables acceleration and inertia here and walks straight at the target with a
     * speed-limited step, so the finger and the drone stay 1:1 and aiming is exact.
     * [tx]/[ty] are the absolute target in 480x800 space -- the caller ([Sim]) owns
     * the relative rebasing, exactly as `Input` does on the web.
     *
     * Known debt, written down rather than hidden: this branch has **no golden
     * trace yet**, so it is not measured parity. The keyboard branch above is, and
     * nothing here touches it.
     */
    public fun updateTouch(dt: Double, rawTx: Double, rawTy: Double) {
        val h = Config.PLAYER.half
        val tx = JsMath.max(h, JsMath.min(Config.W - h, rawTx))
        val ty = JsMath.max(h, JsMath.min(Config.H - h, rawTy))
        val dx = tx - x
        val dy = ty - y
        val dist = JsMath.hypot(dx, dy)
        val step = Config.PLAYER.followSpeed * dt
        if (dist <= step || dist == 0.0) {
            x = tx
            y = ty
            vx = 0.0
            vy = 0.0
        } else {
            x += dx / dist * step
            y += dy / dist * step
            // The velocity is reported, not integrated -- draw-side banking reads it.
            vx = dx / dist * Config.PLAYER.followSpeed
            vy = dy / dist * Config.PLAYER.followSpeed
        }
        clampTouch()
    }

    /**
     * `_clamp()` -- the touch branch's own clamp, and deliberately NOT the four
     * unconditional `if`s the keyboard path uses: it is if/else-if per axis, it
     * clamps at `PLAYER.half` rather than `hitR()`, and it only zeroes the velocity
     * when that velocity is pushing into the wall.
     */
    private fun clampTouch() {
        val h = Config.PLAYER.half
        if (x < h) { x = h; if (vx < 0.0) vx = 0.0 }
        else if (x > Config.W - h) { x = Config.W - h; if (vx > 0.0) vx = 0.0 }
        if (y < h) { y = h; if (vy < 0.0) vy = 0.0 }
        else if (y > Config.H - h) { y = Config.H - h; if (vy > 0.0) vy = 0.0 }
    }

    public companion object {
        /** `CONFIG.DRONES.find(d => d.id === (droneId || 'falcon')) || CONFIG.DRONES[0]`. */
        public const val DEFAULT_DRONE: String = Config.DRONES._0.id

        private fun speedOf(id: String): Double = when (id) {
            Config.DRONES._0.id -> Config.DRONES._0.speed
            Config.DRONES._1.id -> Config.DRONES._1.speed
            Config.DRONES._2.id -> Config.DRONES._2.speed
            Config.DRONES._3.id -> Config.DRONES._3.speed
            else -> Config.DRONES._0.speed   // unknown id falls back to DRONES[0]
        }

        private fun hitboxMulOf(id: String): Double = when (id) {
            // Only `tank` declares hitboxMul; `D.hitboxMul || 1` gives 1 for the rest.
            Config.DRONES._2.id -> Config.DRONES._2.hitboxMul
            else -> 1.0
        }
    }
}
