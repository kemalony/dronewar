package dev.dronewar.bench.canvas

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager

class BenchCanvasActivity : Activity() {
    private lateinit var view: CanvasRenderView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val frames = intent.getIntExtra("frames", 900)
        view = CanvasRenderView(this, frames, intent.getBooleanExtra("nodraw", false)) { finish() }
        setContentView(view)
    }

    override fun onPause() { super.onPause(); view.pauseLoop() }
    override fun onResume() { super.onResume(); view.resumeLoop() }
}
