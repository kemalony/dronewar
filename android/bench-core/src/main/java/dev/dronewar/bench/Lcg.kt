package dev.dronewar.bench

/**
 * Benchmark-only LCG. Good enough to place sprites deterministically for the ADR scene.
 *
 * DO NOT COPY THIS INTO :core-sim. nextFloat() returns a 24-bit-mantissa Float, so it
 * cannot reproduce the web build bit-for-bit; JS has one number type and it is float64.
 * The port's LCG must go through Double. See docs/android-architecture.md, section 4.
 */
class Lcg(seed: Int) {
    private var s: Int = seed

    fun nextInt(): Int {
        s = s * 1664525 + 1013904223
        return s
    }

    /** [0,1) with 24 bits of mantissa, identical on every platform. */
    fun nextFloat(): Float = ((nextInt() ushr 8) and 0xFFFFFF) / 16777216.0f

    fun range(lo: Float, hi: Float): Float = lo + (hi - lo) * nextFloat()
}
