package dev.dronewar.sim

/**
 * The handful of JS `Math` operations the player sim needs, reproduced bit-exactly
 * on the JVM.
 *
 * Two rules hold everywhere in this file, and in the whole module:
 *
 *  1. `java.lang.StrictMath`, never `java.lang.Math`. Both V8 and OpenJDK derive
 *     their transcendentals from fdlibm, but `Math` is intrinsified and the HotSpot
 *     intrinsic may differ from fdlibm in the last ulp. `StrictMath` is specified to
 *     be fdlibm, so it is reproducible. `kotlin.math.pow/abs/min/max` compile down to
 *     `java.lang.Math`, so they are unusable here -- a bytecode scan enforces this.
 *  2. `Double` only. JS has one number type and it is float64.
 *
 * Everything here is allocation-free: plain statics over primitives.
 */
internal object JsMath {

    /** `Math.min(a, b)` with JS/IEEE semantics, without touching `java.lang.Math`. */
    fun min(a: Double, b: Double): Double {
        if (a != a || b != b) return Double.NaN
        if (a < b) return a
        if (b < a) return b
        // Equal, which includes +0.0 vs -0.0: Math.min must prefer -0.0.
        return if (StrictMath.copySign(1.0, a) < 0.0) a else b
    }

    /**
     * `Math.hypot(x, y)` **as V8 computes it**, which is NOT the same function as
     * `StrictMath.hypot`.
     *
     * V8 does not use fdlibm here: it scales both arguments by the larger magnitude,
     * sums the squares with Kahan compensation, then multiplies the square root back
     * by the scale. fdlibm's `__ieee754_hypot` takes a different route and disagrees
     * in the last ulp on ordinary inputs.
     *
     * This is not a theoretical worry. Replaying the golden trace with
     * `StrictMath.hypot` diverges at step 385 (`vy`: ...29a2 vs ...29a3) and with a
     * naive `sqrt(x*x + y*y)` at step 384 (`vx`: ...4532 vs ...4531), both inside the
     * up+right diagonal where the max-speed cap is live. The algorithm below is the
     * one that reproduces all 720 steps.
     */
    fun hypot(x: Double, y: Double): Double {
        val a = StrictMath.abs(x)
        val b = StrictMath.abs(y)
        if (a == Double.POSITIVE_INFINITY || b == Double.POSITIVE_INFINITY) {
            return Double.POSITIVE_INFINITY
        }
        var max = if (a > b) a else b
        if (max == 0.0) max = 1.0
        var sum = 0.0
        var compensation = 0.0

        var n = a / max
        var summand = n * n - compensation
        val preliminary = sum + summand
        compensation = (preliminary - sum) - summand
        sum = preliminary

        n = b / max
        summand = n * n - compensation
        // V8 updates `compensation` once more here; with only two arguments nothing
        // reads it again, so the store is dropped rather than written and ignored.
        sum += summand

        return StrictMath.sqrt(sum) * max
    }

    /** `Math.pow`. Kept here so every math call in the module reads from one place. */
    fun pow(base: Double, exponent: Double): Double = StrictMath.pow(base, exponent)

    /** `Math.abs`. */
    fun abs(v: Double): Double = StrictMath.abs(v)
}
