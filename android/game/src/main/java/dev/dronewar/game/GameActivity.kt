package dev.dronewar.game

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager

/**
 * The slice's only activity.
 *
 * Two debug extras exist so the gate can measure AC-3/AC-4/AC-5 without a human
 * hand on the screen. They drive the same code path a finger does -- they do not
 * open a second one -- which is the only way the measurement means anything:
 *
 *   adb shell am start -n dev.dronewar.game/.GameActivity --ei autoplay 12
 *   adb shell am start -n dev.dronewar.game/.GameActivity --ei autoplay 12 --ez killplayer true
 */
class GameActivity : Activity() {

    private lateinit var view: GameView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        view = GameView(
            this,
            intent.getIntExtra("autoplay", 0),
            intent.getBooleanExtra("killplayer", false)
        )
        setContentView(view)
    }

    override fun onPause() { super.onPause(); view.pauseLoop() }
    override fun onResume() { super.onResume(); view.resumeLoop() }
}
