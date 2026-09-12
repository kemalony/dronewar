package dev.dronewar.bench.canvas

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import dev.dronewar.bench.Metrics
import dev.dronewar.bench.Scene

/**
 * Candidate A: SurfaceView driven by a dedicated render thread, drawing through
 * Canvas 2D on a hardware-locked surface.
 */
class CanvasRenderView(
    context: Context,
    private val targetFrames: Int,
    /** Control run: keep the loop and the sim, draw nothing. Proves cpu_ms measures drawing. */
    private val noDraw: Boolean,
    private val onFinished: () -> Unit
) : SurfaceView(context), SurfaceHolder.Callback, Runnable {

    private val scene = Scene()
    private val metrics = Metrics("canvas", targetFrames)
    private val processStartNanos = Process.getStartUptimeMillis() * 1_000_000L

    private var thread: Thread? = null
    @Volatile private var running = false
    @Volatile private var paused = false

    private val sprites = HashMap<String, Bitmap>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val addPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.ADD)
    }
    private val arcRect = RectF()

    // Internal 480x800 mapped onto the real surface once per frame.
    private var scaleX = 1f
    private var scaleY = 1f

    init {
        holder.addCallback(this)
        isFocusable = true
        for (n in NAMES.distinct()) {
            context.assets.open("sprites/$n.png").use {
                sprites[n] = BitmapFactory.decodeStream(it)
            }
        }
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        running = true
        thread = Thread(this, "bench-canvas").also { it.start() }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, w: Int, h: Int) {
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
        var last = System.nanoTime()
        while (running && !metrics.done) {
            if (paused) { SystemClock.sleep(8); last = System.nanoTime(); continue }

            val frameStart = System.nanoTime()
            val rawDt = ((frameStart - last) / 1_000_000_000.0).toFloat()
            last = frameStart
            scene.advance(rawDt)

            val canvas = lockCanvasCompat() ?: continue
            val cpuEnd: Long
            try {
                if (!noDraw) drawScene(canvas) else canvas.drawColor(Color.BLACK)
            } finally {
                cpuEnd = System.nanoTime()
                holder.unlockCanvasAndPost(canvas)
            }
            metrics.onFrameEnd(frameStart, cpuEnd, System.nanoTime(), processStartNanos)
        }
        if (metrics.done) {
            metrics.dump(context, mapOf("surface" to "SurfaceView+Canvas", "nodraw" to noDraw.toString()))
            post { onFinished() }
        }
    }

    private fun lockCanvasCompat(): Canvas? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) holder.lockHardwareCanvas()
        else holder.lockCanvas()

    private fun drawScene(c: Canvas) {
        c.drawColor(Color.BLACK)
        c.save()
        c.scale(scaleX, scaleY)

        val city = sprites["city_istanbul"]!!
        // Three parallax layers, each wrapped with a second copy above it.
        for (layer in 0 until Scene.CITY_LAYERS) {
            paint.alpha = LAYER_ALPHA[layer]
            val y = scene.cityY[layer]
            drawCity(c, city, y)
            drawCity(c, city, y - Scene.H)
        }
        paint.alpha = 255

        // Bullet tracers: procedural, exactly like the web build.
        paint.color = TRACER_OUTER
        for (i in 0 until Scene.BULLETS) {
            c.drawRect(scene.bulletX[i] - 2f, scene.bulletY[i], scene.bulletX[i] + 2f, scene.bulletY[i] + 22f, paint)
        }
        paint.color = TRACER_CORE
        for (i in 0 until Scene.BULLETS) {
            c.drawRect(scene.bulletX[i] - 1f, scene.bulletY[i] + 4f, scene.bulletX[i] + 1f, scene.bulletY[i] + 16f, paint)
        }

        for (i in 0 until Scene.ENEMIES) {
            val bmp = sprites[NAMES[scene.enemySprite[i]]] ?: continue
            drawSprite(c, bmp, scene.enemyX[i], scene.enemyY[i], scene.enemySize[i], scene.enemyVx[i])
            drawRotors(c, scene.enemyX[i], scene.enemyY[i], scene.enemySize[i])
        }

        drawSprite(c, sprites["drone_player"]!!, scene.playerX, scene.playerY, 64f, scene.targetX - scene.playerX)
        drawRotors(c, scene.playerX, scene.playerY, 64f)

        // Sparks, additive, batched by one paint.
        for (i in 0 until Scene.PARTICLES) {
            addPaint.color = SPARK_COLOR
            addPaint.alpha = (scene.partLife[i] * 255f).toInt().coerceIn(0, 255)
            c.drawCircle(scene.partX[i], scene.partY[i], 2.5f, addPaint)
        }

        val boom = sprites["boom_fire"]!!
        addPaint.alpha = 160
        drawSpriteAdd(c, boom, 120f, 220f, 96f)
        drawSpriteAdd(c, boom, 330f, 470f, 76f)

        c.restore()
    }

    private fun drawCity(c: Canvas, bmp: Bitmap, y: Float) {
        c.save()
        c.translate(0f, y)
        c.scale(Scene.W / bmp.width, Scene.H / bmp.height)
        c.drawBitmap(bmp, 0f, 0f, paint)
        c.restore()
    }

    private fun drawSprite(c: Canvas, bmp: Bitmap, x: Float, y: Float, size: Float, vx: Float) {
        c.save()
        c.translate(x, y)
        // Manoeuvre bank, capped at the +/-22 degrees the visuals gate asks for.
        c.rotate((vx * 0.35f).coerceIn(-22f, 22f))
        val s = size / bmp.width
        c.scale(s, s)
        c.drawBitmap(bmp, -bmp.width * 0.5f, -bmp.height * 0.5f, paint)
        c.restore()
    }

    private fun drawSpriteAdd(c: Canvas, bmp: Bitmap, x: Float, y: Float, size: Float) {
        c.save()
        c.translate(x, y)
        val s = size / bmp.width
        c.scale(s, s)
        c.drawBitmap(bmp, -bmp.width * 0.5f, -bmp.height * 0.5f, addPaint)
        c.restore()
    }

    private fun drawRotors(c: Canvas, x: Float, y: Float, size: Float) {
        val r = size * 0.22f
        val a = (scene.simTimeMs / 1000.0 * 18.0 % 360.0).toFloat()
        addPaint.color = ROTOR_COLOR
        addPaint.alpha = 120
        for (k in 0 until 4) {
            val cx = x + if (k and 1 == 0) -size * 0.32f else size * 0.32f
            val cy = y + if (k < 2) -size * 0.28f else size * 0.28f
            arcRect.set(cx - r, cy - r, cx + r, cy + r)
            c.drawArc(arcRect, a + k * 90f, 120f, false, addPaint)
        }
    }

    private companion object {
        val NAMES = arrayOf(
            "city_istanbul", "drone_player", "drone_scout", "drone_gunner",
            "drone_shield", "drone_shield", "drone_scout", "boom_fire"
        )
        val LAYER_ALPHA = intArrayOf(110, 170, 255)
        const val TRACER_OUTER = 0xFF35D6FF.toInt()
        const val TRACER_CORE = 0xFFFFFFFF.toInt()
        const val SPARK_COLOR = 0xFFFFC24A.toInt()
        const val ROTOR_COLOR = 0xFFBFEFFF.toInt()
    }
}
