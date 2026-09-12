package dev.dronewar.sim

/**
 * The web build's linear congruential generator, on `Int` and `Double`.
 *
 * ```js
 * s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
 * return s / 4294967296;
 * ```
 *
 * `Math.imul` is 32-bit wrapping multiplication, which is exactly what Kotlin `Int`
 * multiplication already does, so the state update ports one for one. `>>> 0` makes
 * the state unsigned; here that is the mask back to a `Long` before the divide.
 *
 * The divisor 2^32 is a power of two, so the quotient is exact for every state --
 * no rounding, therefore nothing to get bit-wrong. Returning `Double` and not
 * `Float` is what makes it usable: `android/bench-core/Lcg.kt` returns a 24-bit
 * `Float` and cannot reproduce the web stream.
 *
 * Nothing in the R1 phase-1 golden trace draws from this (it is a player-only
 * trace), but the streams it will feed are named and seeded per run, so it lives
 * here from the start rather than being bolted on later.
 */
public class Lcg(seed: Int = 0) {

    /** Raw 32-bit state, as an `Int` with wrapping arithmetic. */
    @JvmField
    public var state: Int = seed

    /** Advances the state and returns it as an unsigned 32-bit value. */
    public fun nextBits(): Long {
        state = state * 1664525 + 1013904223
        return state.toLong() and 0xFFFFFFFFL
    }

    /** Next draw in `[0, 1)`. Exact: the divisor is a power of two. */
    public fun nextDouble(): Double = nextBits().toDouble() / 4294967296.0

    public fun reseed(seed: Int) {
        state = seed
    }
}
