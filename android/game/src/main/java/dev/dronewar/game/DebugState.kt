package dev.dronewar.game

import android.content.Context
import android.util.Log
import java.io.File
import java.util.Locale

/**
 * The `state()` hook, in the shape the gate reads it.
 *
 * The web build is measurable because `state()` exposes the run to the harness; a
 * native feature that cannot be read back is a feature the gate cannot see, so this
 * ships with the slice rather than after it.
 *
 * Two sinks, on purpose: a logcat line for watching a run live, and a JSON file so
 * `adb shell cat` does not have to race the log buffer. The file is written via a
 * temporary and renamed, so a reader never catches a half-written object.
 */
class DebugState(context: Context) {

    companion object {
        const val TAG = "DroneWarGame"
        private const val FILE_NAME = "game-state.json"
        /** Heartbeat period. Measurement cadence, not a gameplay number. */
        const val EMIT_INTERVAL_NANOS = 1_000_000_000L
    }

    private val dir: File? = context.getExternalFilesDir(null)
    private val out = File(dir, FILE_NAME)
    private val tmp = File(dir, "$FILE_NAME.tmp")
    private val sb = StringBuilder(256)

    fun emit(
        mode: String, score: Int, lives: Int, kills: Int, shotsFired: Int,
        enemies: Int, bullets: Int, playerX: Double, playerY: Double,
        drawCalls: Int, frames: Long
    ) {
        sb.setLength(0)
        sb.append("{\"mode\":\"").append(mode)
            .append("\",\"score\":").append(score)
            .append(",\"lives\":").append(lives)
            .append(",\"kills\":").append(kills)
            .append(",\"shotsFired\":").append(shotsFired)
            .append(",\"enemies\":").append(enemies)
            .append(",\"bullets\":").append(bullets)
            .append(",\"playerX\":").append(String.format(Locale.US, "%.2f", playerX))
            .append(",\"playerY\":").append(String.format(Locale.US, "%.2f", playerY))
            .append(",\"drawCalls\":").append(drawCalls)
            .append(",\"frames\":").append(frames)
            .append("}")
        val json = sb.toString()
        Log.i(TAG, "GAMESTATE $json")
        if (dir == null) return
        try {
            tmp.writeText(json)
            if (!tmp.renameTo(out)) out.writeText(json)
        } catch (e: Exception) {
            Log.w(TAG, "state write failed: ${e.message}")
        }
    }
}
