package dev.dronewar.bench.gl

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES20
import android.opengl.GLUtils
import android.os.Process
import android.os.SystemClock
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import dev.dronewar.bench.Metrics
import dev.dronewar.bench.Scene

/**
 * Candidate B: SurfaceView with a hand-rolled EGL context and an ES 2.0 sprite batch.
 * The loop shape deliberately mirrors CanvasRenderView so the two measurements differ
 * only in the drawing API.
 */
class GlRenderView(
    context: Context,
    private val targetFrames: Int,
    /** Control run: keep the loop and the sim, draw nothing. Proves cpu_ms measures drawing. */
    private val noDraw: Boolean,
    private val onFinished: () -> Unit
) : SurfaceView(context), SurfaceHolder.Callback, Runnable {

    private val scene = Scene()
    private val metrics = Metrics("gl", targetFrames)
    private val processStartNanos = Process.getStartUptimeMillis() * 1_000_000L
    private val batch = SpriteBatch()

    private var thread: Thread? = null
    @Volatile private var running = false
    @Volatile private var paused = false
    @Volatile private var viewW = 1
    @Volatile private var viewH = 1

    private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE

    private val textures = HashMap<String, Int>()
    private var whiteTex = 0
    private var ringTex = 0
    private var lastDrawCalls = 0

    private var scaleX = 1f
    private var scaleY = 1f

    init {
        holder.addCallback(this)
        isFocusable = true
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        running = true
        thread = Thread(this, "bench-gl").also { it.start() }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, w: Int, h: Int) {
        viewW = w; viewH = h
        scaleX = w / Scene.W
        scaleY = h / Scene.H
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        running = false
        thread?.join(2000)
        thread = null
    }

    fun pauseLoop() { paused = true }
    fun resumeLoop() { paused = false }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                scene.targetX = (event.x / scaleX).coerceIn(0f, Scene.W)
                scene.targetY = (event.y / scaleY).coerceIn(0f, Scene.H)
                metrics.noteTouch(event.eventTime * 1_000_000L)
            }
        }
        return true
    }

    override fun run() {
        initEgl()
        batch.create(Scene.W, Scene.H)
        loadTextures()

        var last = System.nanoTime()
        while (running && !metrics.done) {
            if (paused) { SystemClock.sleep(8); last = System.nanoTime(); continue }

            val frameStart = System.nanoTime()
            val rawDt = ((frameStart - last) / 1_000_000_000.0).toFloat()
            last = frameStart
            scene.advance(rawDt)

            GLES20.glViewport(0, 0, viewW, viewH)
            GLES20.glClearColor(0f, 0f, 0f, 1f)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
            if (!noDraw) drawScene()
            // Force the driver to accept the command stream before we stop the clock,
            // so cpu_ms covers the same span the Canvas candidate measures.
            GLES20.glFlush()
            val cpuEnd = System.nanoTime()

            EGL14.eglSwapBuffers(display, eglSurface)
            metrics.onFrameEnd(frameStart, cpuEnd, System.nanoTime(), processStartNanos)
        }

        if (metrics.done) {
            metrics.dump(
                context,
                mapOf(
                    "surface" to "SurfaceView+EGL/GLES20",
                    "draw_calls" to lastDrawCalls.toString(),
                    "nodraw" to noDraw.toString()
                )
            )
            post { onFinished() }
        }
        releaseEgl()
    }

    private fun drawScene() {
        batch.begin()

        val city = textures["city_istanbul"]!!
        for (layer in 0 until Scene.CITY_LAYERS) {
            val a = LAYER_ALPHA[layer]
            val y = scene.cityY[layer]
            batch.draw(city, 0f, y, Scene.W, Scene.H, a = a)
            batch.draw(city, 0f, y - Scene.H, Scene.W, Scene.H, a = a)
        }

        for (i in 0 until Scene.BULLETS) {
            batch.draw(whiteTex, scene.bulletX[i] - 2f, scene.bulletY[i], 4f, 22f, 0.21f, 0.84f, 1f, 1f)
        }
        for (i in 0 until Scene.BULLETS) {
            batch.draw(whiteTex, scene.bulletX[i] - 1f, scene.bulletY[i] + 4f, 2f, 12f, 1f, 1f, 1f, 1f)
        }

        // Bodies grouped by texture, then every rotor in one pass. Interleaving them
        // costs a batch flush per drone; grouping keeps the whole scene near ten calls.
        for (slot in ENEMY_SLOTS) {
            val tex = textures[NAMES[slot]] ?: continue
            for (i in 0 until Scene.ENEMIES) {
                if (scene.enemySprite[i] != slot) continue
                val size = scene.enemySize[i]
                val bank = (scene.enemyVx[i] * 0.35f).coerceIn(-22f, 22f) * DEG_TO_RAD
                batch.drawRotated(tex, scene.enemyX[i], scene.enemyY[i], size, size, bank)
            }
        }

        val bank = ((scene.targetX - scene.playerX) * 0.35f).coerceIn(-22f, 22f) * DEG_TO_RAD
        batch.drawRotated(textures["drone_player"]!!, scene.playerX, scene.playerY, 64f, 64f, bank)

        for (i in 0 until Scene.ENEMIES) {
            drawRotors(scene.enemyX[i], scene.enemyY[i], scene.enemySize[i])
        }
        drawRotors(scene.playerX, scene.playerY, 64f)

        for (i in 0 until Scene.PARTICLES) {
            val a = scene.partLife[i].coerceIn(0f, 1f)
            batch.draw(whiteTex, scene.partX[i] - 2.5f, scene.partY[i] - 2.5f, 5f, 5f,
                1f, 0.76f, 0.29f, a, SpriteBatch.BLEND_ADD)
        }

        val boom = textures["boom_fire"]!!
        batch.draw(boom, 120f - 48f, 220f - 48f, 96f, 96f, 1f, 1f, 1f, 0.63f, SpriteBatch.BLEND_ADD)
        batch.draw(boom, 330f - 38f, 470f - 38f, 76f, 76f, 1f, 1f, 1f, 0.63f, SpriteBatch.BLEND_ADD)

        batch.end()
        lastDrawCalls = batch.drawCalls
    }

    private fun drawRotors(x: Float, y: Float, size: Float) {
        val r = size * 0.22f
        for (k in 0 until 4) {
            val cx = x + if (k and 1 == 0) -size * 0.32f else size * 0.32f
            val cy = y + if (k < 2) -size * 0.28f else size * 0.28f
            batch.draw(ringTex, cx - r, cy - r, r * 2f, r * 2f,
                0.75f, 0.94f, 1f, 0.47f, SpriteBatch.BLEND_ADD)
        }
    }

    private fun loadTextures() {
        for (n in NAMES.distinct()) {
            context.assets.open("sprites/$n.png").use { stream ->
                val bmp = BitmapFactory.decodeStream(stream)
                textures[n] = upload(bmp)
                bmp.recycle()
            }
        }
        whiteTex = upload(Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888).apply {
            setPixel(0, 0, -0x1)
        })
        ringTex = upload(makeRing())
    }

    /** Procedural rotor arc, the GL analogue of the Canvas drawArc stroke. */
    private fun makeRing(): Bitmap {
        val size = 64
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = size * 0.12f
            color = -0x1
        }
        val inset = p.strokeWidth * 0.5f + 1f
        c.drawArc(inset, inset, size - inset, size - inset, 0f, 120f, false, p)
        return bmp
    }

    private fun upload(bmp: Bitmap): Int {
        val ids = IntArray(1)
        GLES20.glGenTextures(1, ids, 0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, ids[0])
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0)
        return ids[0]
    }

    private fun initEgl() {
        display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        val version = IntArray(2)
        check(EGL14.eglInitialize(display, version, 0, version, 1)) { "eglInitialize failed" }

        val attribs = intArrayOf(
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGL14.EGL_SURFACE_TYPE, EGL14.EGL_WINDOW_BIT,
            EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8, EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val numConfig = IntArray(1)
        check(EGL14.eglChooseConfig(display, attribs, 0, configs, 0, 1, numConfig, 0) && numConfig[0] > 0) {
            "eglChooseConfig failed"
        }
        val config = configs[0]!!

        eglContext = EGL14.eglCreateContext(
            display, config, EGL14.EGL_NO_CONTEXT,
            intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0
        )
        check(eglContext != EGL14.EGL_NO_CONTEXT) { "eglCreateContext failed" }

        eglSurface = EGL14.eglCreateWindowSurface(
            display, config, holder.surface, intArrayOf(EGL14.EGL_NONE), 0
        )
        check(eglSurface != EGL14.EGL_NO_SURFACE) { "eglCreateWindowSurface failed" }
        check(EGL14.eglMakeCurrent(display, eglSurface, eglSurface, eglContext)) { "eglMakeCurrent failed" }
    }

    private fun releaseEgl() {
        if (display == EGL14.EGL_NO_DISPLAY) return
        EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
        if (eglSurface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(display, eglSurface)
        if (eglContext != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(display, eglContext)
        EGL14.eglTerminate(display)
        display = EGL14.EGL_NO_DISPLAY
    }

    private companion object {
        val NAMES = arrayOf(
            "city_istanbul", "drone_player", "drone_scout", "drone_gunner",
            "drone_shield", "drone_shield", "drone_scout", "boom_fire"
        )
        val LAYER_ALPHA = floatArrayOf(0.43f, 0.67f, 1f)
        const val DEG_TO_RAD = 0.017453292f
        val ENEMY_SLOTS = intArrayOf(Scene.Sprite.SCOUT, Scene.Sprite.GUNNER, Scene.Sprite.SHIELD)
    }
}
