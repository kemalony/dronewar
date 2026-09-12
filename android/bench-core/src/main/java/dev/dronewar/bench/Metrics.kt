package dev.dronewar.bench

import android.content.Context
import android.util.Log
import java.io.File

/**
 * Collects the numbers the ADR is decided on. Every candidate reports through this
 * one class so the three result files are directly comparable.
 *
 * Two clocks per frame, because they answer different questions:
 *  - cpu_ms   : sim + issuing every draw command, measured before the present call.
 *               This is the "hot frame" budget; it is the only part the platform
 *               choice changes, and it is not clamped by vsync.
 *  - frame_ms : wall clock between frame starts, which sits at the refresh interval
 *               whenever the app keeps up and spikes when it does not.
 *
 * Touch latency runs from MotionEvent.getEventTime() to the moment the frame carrying
 * that finger position finished presenting. Panel-to-app latency is identical on all
 * three candidates and is deliberately outside the measurement.
 */
class Metrics(private val backend: String, private val targetFrames: Int) {

    companion object {
        const val TAG = "DroneWarBench"
        const val RESULT_FILE = "bench-result.json"
        /** Frames slower than this on a 60 Hz panel are counted as dropped. */
        private const val DROP_THRESHOLD_MS = 20.0
        /** Startup, texture upload and shader warm-up noise is excluded from percentiles. */
        private const val WARMUP_FRAMES = 30
    }

    private val cpuMs = DoubleArray(targetFrames)
    private val frameMs = DoubleArray(targetFrames)
    private var frameCount = 0

    private val touchMs = ArrayList<Double>(256)
    private var pendingTouchNanos = 0L
    private var hasPendingTouch = false

    private var runStartNanos = 0L

    var coldCpuMs = 0.0; private set
    /** Process start (Process.getStartUptimeMillis) to first finished frame. */
    var firstFrameMs = 0.0; private set
    var done = false; private set

    fun noteTouch(eventTimeNanos: Long) {
        if (!hasPendingTouch) {
            pendingTouchNanos = eventTimeNanos
            hasPendingTouch = true
        }
    }

    /**
     * @param frameStartNanos  before sim and draw
     * @param cpuEndNanos      after the last draw command is issued, before present
     * @param frameEndNanos    after present returns
     */
    fun onFrameEnd(
        frameStartNanos: Long,
        cpuEndNanos: Long,
        frameEndNanos: Long,
        processStartNanos: Long
    ) {
        if (done) return
        val cpu = (cpuEndNanos - frameStartNanos) / 1_000_000.0
        val wall = (frameEndNanos - frameStartNanos) / 1_000_000.0

        if (frameCount == 0) {
            coldCpuMs = cpu
            firstFrameMs = (frameEndNanos - processStartNanos) / 1_000_000.0
            runStartNanos = frameStartNanos
        }
        if (frameCount < targetFrames) {
            cpuMs[frameCount] = cpu
            frameMs[frameCount] = wall
        }
        frameCount++

        if (hasPendingTouch) {
            touchMs.add((frameEndNanos - pendingTouchNanos) / 1_000_000.0)
            hasPendingTouch = false
        }

        if (frameCount >= targetFrames) {
            done = true
            runWallMs = (frameEndNanos - runStartNanos) / 1_000_000.0
        }
    }

    private var runWallMs = 0.0

    private fun percentile(sorted: DoubleArray, p: Double): Double {
        if (sorted.isEmpty()) return 0.0
        val idx = ((sorted.size - 1) * p).toInt().coerceIn(0, sorted.size - 1)
        return sorted[idx]
    }

    /** Writes the result JSON and echoes it to logcat for the harness to scrape. */
    fun dump(context: Context, extra: Map<String, String> = emptyMap()): String {
        val n = minOf(frameCount, targetFrames)
        val from = minOf(WARMUP_FRAMES, n)
        val warmN = maxOf(0, n - from)

        val cpu = DoubleArray(warmN) { cpuMs[from + it] }
        val wall = DoubleArray(warmN) { frameMs[from + it] }
        val dropped = wall.count { it > DROP_THRESHOLD_MS }
        cpu.sort(); wall.sort()

        val touch = touchMs.toDoubleArray()
        touch.sort()

        val fps = if (runWallMs > 0.0) frameCount * 1000.0 / runWallMs else 0.0

        val sb = StringBuilder(1024)
        sb.append("{\n")
        sb.append(str("backend", backend))
        sb.append("  \"frames\": ").append(frameCount).append(",\n")
        sb.append("  \"warm_frames\": ").append(warmN).append(",\n")
        sb.append(num("cold_cpu_ms", coldCpuMs))
        sb.append(num("first_frame_ms", firstFrameMs))
        sb.append(num("cpu_p50_ms", percentile(cpu, 0.50)))
        sb.append(num("cpu_p95_ms", percentile(cpu, 0.95)))
        sb.append(num("cpu_p99_ms", percentile(cpu, 0.99)))
        sb.append(num("cpu_max_ms", if (warmN > 0) cpu[warmN - 1] else 0.0))
        sb.append(num("frame_p50_ms", percentile(wall, 0.50)))
        sb.append(num("frame_p95_ms", percentile(wall, 0.95)))
        sb.append(num("fps", fps))
        sb.append("  \"dropped_frames\": ").append(dropped).append(",\n")
        sb.append("  \"touch_samples\": ").append(touch.size).append(",\n")
        sb.append(num("touch_p50_ms", percentile(touch, 0.50)))
        sb.append(num("touch_p95_ms", percentile(touch, 0.95)))
        for ((k, v) in extra) sb.append(str(k, v))
        sb.append("  \"schema\": 2\n}")

        val json = sb.toString()
        val out = File(context.getExternalFilesDir(null), RESULT_FILE)
        out.writeText(json)
        Log.i(TAG, "RESULT $backend ${json.replace("\n", " ")}")
        Log.i(TAG, "DONE $backend")
        return json
    }

    private fun str(key: String, v: String): String = "  \"$key\": \"$v\",\n"
    private fun num(key: String, v: Double): String =
        "  \"$key\": ${String.format(java.util.Locale.US, "%.3f", v)},\n"
}
