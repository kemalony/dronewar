package dev.dronewar.harness

import com.sun.management.ThreadMXBean
import dev.dronewar.sim.Sim
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.lang.management.ManagementFactory

/**
 * alloc (AC-6).
 *
 * `advance()` must allocate zero bytes per call. This is not a performance nicety:
 * the sim step is the hot loop of a 120Hz game on a phone, and an allocation per step
 * is 120 garbage objects a second per tracked quantity, which is how a port that
 * passes parity on a desktop JVM still stutters on a mid-range device.
 *
 * Measured with `com.sun.management.ThreadMXBean.getThreadAllocatedBytes`, which
 * HotSpot accounts per thread (retired TLABs plus the live one). No dependency, no
 * profiler, no sampling.
 */
class AllocationTest {

    private val trace = GoldenTrace.load()

    @Test
    fun `advance allocates zero bytes per call`() {
        val bean = ManagementFactory.getThreadMXBean() as? ThreadMXBean
            ?: error("com.sun.management.ThreadMXBean is not available on this JVM; AC-6 cannot be measured")
        assertTrue(bean.isThreadAllocatedMemorySupported, "thread allocation accounting is not supported")
        bean.isThreadAllocatedMemoryEnabled = true

        val threadId = java.lang.Thread.currentThread().id
        val tickMs = trace.header.tickMs
        val sim = Sim()
        sim.press(dev.dronewar.sim.Key.RIGHT)

        // Warm up hard enough that the steady state is C2-compiled code. Measuring a
        // cold loop would report class loading and profiling overhead as sim garbage.
        val warmup = 200_000
        for (i in 0 until warmup) sim.advance(tickMs)

        // The measuring loop itself allocates nothing, so any delta is the sim's.
        // Three rounds, and the verdict is the minimum: a genuine per-call allocation
        // is present in every round, while a one-off (a late recompile, a counter
        // rolling over) is not. The assertion is still a hard zero -- no tolerance
        // lives in this module.
        val rounds = 3
        val perRound = 200_000
        val deltas = LongArray(rounds)
        for (r in 0 until rounds) {
            val before = bean.getThreadAllocatedBytes(threadId)
            for (i in 0 until perRound) sim.advance(tickMs)
            deltas[r] = bean.getThreadAllocatedBytes(threadId) - before
        }
        val best = deltas.reduce { a, b -> if (b < a) b else a }

        println(
            "alloc: advance() x $perRound, ${rounds} rounds -> ${deltas.joinToString(", ") { "$it B" }}; " +
                "best = $best B (${best.toDouble() / perRound} B/call) after $warmup warmup calls"
        )

        assertEquals(
            0L, best,
            "advance() allocated $best bytes over $perRound calls " +
                "(${best.toDouble() / perRound} bytes per call); the sim step must not allocate. " +
                "Rounds: ${deltas.joinToString(", ")}",
        )
    }

    @Test
    fun `press and release allocate zero bytes per call`() {
        val bean = ManagementFactory.getThreadMXBean() as? ThreadMXBean
            ?: error("com.sun.management.ThreadMXBean is not available on this JVM")
        bean.isThreadAllocatedMemoryEnabled = true
        val threadId = java.lang.Thread.currentThread().id
        val sim = Sim()
        val key = dev.dronewar.sim.Key.LEFT

        for (i in 0 until 100_000) { sim.press(key); sim.release(key) }

        val n = 200_000
        val before = bean.getThreadAllocatedBytes(threadId)
        for (i in 0 until n) { sim.press(key); sim.release(key) }
        val delta = bean.getThreadAllocatedBytes(threadId) - before

        println("alloc: press/release x $n -> $delta B")
        assertEquals(0L, delta, "press/release allocated $delta bytes over $n pairs")
    }
}
