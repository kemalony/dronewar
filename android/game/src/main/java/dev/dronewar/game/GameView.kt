package dev.dronewar.game

import android.content.Context
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES20
import android.os.Process
import android.os.SystemClock
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import dev.dronewar.bench.Metrics
import dev.dronewar.rules.Config

/**
 * The playable slice: a SurfaceView with a hand-rolled EGL context and the ES 2.0
 * sprite batch ADR-001 chose, driving [GameSim].
 *
 * The loop shape is `bench-gl`'s on purpose, so AC-5 measures the same thing the ADR
 * measured: `cpu_ms` stops before the present call, `frame_ms` spans frame starts,
 * and [Metrics] writes the same `bench-result.json`.
 *
 * Everything in this file is drawing. The sim owns positions; shake, banking, rotor
 * spin, hit flash and the muzzle glow are computed here and written nowhere else.
 */
class GameView(
    context: Context,
    private val autoplaySeconds: Int,
    private val killPlayer: Boolean
) : SurfaceView(context), SurfaceHolder.Callback, Runnable {

    private companion object {
        const val DEG_TO_RAD = 0.017453292f
        const val BANK_MAX_DEG = 22f
        /** Frames the ADR percentiles are taken over; 30 of them are warm-up. */
        const val TARGET_FRAMES = 300
        const val TEXT_ADVANCE = 0.58f
        const val TAU = 6.283185307179586
        /** Seed for the draw-only cloud layout stream. */
        const val CLOUD_SEED = 24680
    }

    private val fx = Fx()
    private val sim = GameSim(fx)
    private val atlas = Atlas()
    private val batch = SpriteBatch()
    private val metrics = Metrics("game", TARGET_FRAMES)
    private val debug = DebugState(context)
    private val processStartNanos = Process.getStartUptimeMillis() * 1_000_000L

    private var thread: Thread? = null
    @Volatile private var running = false
    @Volatile private var paused = false
    @Volatile private var viewW = 1
    @Volatile private var viewH = 1
    @Volatile private var scale = 1f
    @Volatile private var offX = 0f
    @Volatile private var offY = 0f

    private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE

    private var frames = 0L
    private var drawCalls = 0
    private var dumped = false
    private var lastEmitNanos = 0L
    private var lastMode = -1
    private var drawClock = 0.0

    // Rotor centres, copied out of the :rules table into flat arrays so the draw
    // loop can index them. These reference Config; they are not a second definition.
    private val rotorPlayer = doubleArrayOf(
        Config.ROTOR.centers.drone_player._0._0, Config.ROTOR.centers.drone_player._0._1,
        Config.ROTOR.centers.drone_player._1._0, Config.ROTOR.centers.drone_player._1._1,
        Config.ROTOR.centers.drone_player._2._0, Config.ROTOR.centers.drone_player._2._1,
        Config.ROTOR.centers.drone_player._3._0, Config.ROTOR.centers.drone_player._3._1
    )
    private val rotorScout = doubleArrayOf(
        Config.ROTOR.centers.drone_scout._0._0, Config.ROTOR.centers.drone_scout._0._1,
        Config.ROTOR.centers.drone_scout._1._0, Config.ROTOR.centers.drone_scout._1._1,
        Config.ROTOR.centers.drone_scout._2._0, Config.ROTOR.centers.drone_scout._2._1,
        Config.ROTOR.centers.drone_scout._3._0, Config.ROTOR.centers.drone_scout._3._1
    )
    private val rotorGunner = doubleArrayOf(
        Config.ROTOR.centers.drone_gunner._0._0, Config.ROTOR.centers.drone_gunner._0._1,
        Config.ROTOR.centers.drone_gunner._1._0, Config.ROTOR.centers.drone_gunner._1._1,
        Config.ROTOR.centers.drone_gunner._2._0, Config.ROTOR.centers.drone_gunner._2._1,
        Config.ROTOR.centers.drone_gunner._3._0, Config.ROTOR.centers.drone_gunner._3._1,
        Config.ROTOR.centers.drone_gunner._4._0, Config.ROTOR.centers.drone_gunner._4._1,
        Config.ROTOR.centers.drone_gunner._5._0, Config.ROTOR.centers.drone_gunner._5._1
    )
    private val rotorShield = doubleArrayOf(
        Config.ROTOR.centers.drone_shield._0._0, Config.ROTOR.centers.drone_shield._0._1,
        Config.ROTOR.centers.drone_shield._1._0, Config.ROTOR.centers.drone_shield._1._1,
        Config.ROTOR.centers.drone_shield._2._0, Config.ROTOR.centers.drone_shield._2._1,
        Config.ROTOR.centers.drone_shield._3._0, Config.ROTOR.centers.drone_shield._3._1,
        Config.ROTOR.centers.drone_shield._4._0, Config.ROTOR.centers.drone_shield._4._1,
        Config.ROTOR.centers.drone_shield._5._0, Config.ROTOR.centers.drone_shield._5._1,
        Config.ROTOR.centers.drone_shield._6._0, Config.ROTOR.centers.drone_shield._6._1,
        Config.ROTOR.centers.drone_shield._7._0, Config.ROTOR.centers.drone_shield._7._1
    )
    private val enemySprite = intArrayOf(Sprite.SCOUT, Sprite.GUNNER, Sprite.SHIELD)
    private val enemyRotorRadius = doubleArrayOf(
        Config.ROTOR.radii.drone_scout, Config.ROTOR.radii.drone_gunner, Config.ROTOR.radii.drone_shield
    )
    private val enemyRadius = doubleArrayOf(
        Config.ENEMIES.scout.radius, Config.ENEMIES.gunner.radius, Config.ENEMIES.shield.radius
    )

    private val numBuf = CharArray(12)

    // Per-slot cloud variation, rolled once. Draw-only, so the stream is its own and
    // never touches the spawn stream the sim draws from.
    private val cloudSlots = Config.CLOUDS.maxClouds.toInt()
    private val cloudAlpha = DoubleArray(cloudSlots)
    private val cloudScale = DoubleArray(cloudSlots)
    private val cloudShift = DoubleArray(cloudSlots)

    init {
        val r = dev.dronewar.sim.Lcg(CLOUD_SEED)
        for (k in 0 until cloudSlots) {
            cloudAlpha[k] = Config.CLOUDS.alphaMin +
                r.nextDouble() * (Config.CLOUDS.alphaMax - Config.CLOUDS.alphaMin)
            cloudScale[k] = Config.CLOUDS.scaleMin +
                r.nextDouble() * (Config.CLOUDS.scaleMax - Config.CLOUDS.scaleMin)
            cloudShift[k] = r.nextDouble() * 2.0 - 1.0
        }
    }

    init {
        holder.addCallback(this)
        isFocusable = true
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        running = true
        thread = Thread(this, "dronewar-game").also { it.start() }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, w: Int, h: Int) {
        viewW = w
        viewH = h
        // Letterboxed 480x800: the logical playfield keeps its aspect so the drone is
        // not stretched and the finger maps to world pixels one for one.
        val s = kotlin.math.min(w / Config.W.toFloat(), h / Config.H.toFloat())
        scale = s
        offX = (w - Config.W.toFloat() * s) * 0.5f
        offY = (h - Config.H.toFloat() * s) * 0.5f
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        running = false
        thread?.join(2000)
        thread = null
    }

    fun pauseLoop() { paused = true }
    fun resumeLoop() { paused = false }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val lx = ((event.x - offX) / scale).toDouble()
        val ly = ((event.y - offY) / scale).toDouble()
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                sim.onPointerDown(lx, ly)
                metrics.noteTouch(event.eventTime * 1_000_000L)
            }
            MotionEvent.ACTION_MOVE -> {
                sim.onPointerMove(lx, ly)
                metrics.noteTouch(event.eventTime * 1_000_000L)
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> sim.onPointerUp()
        }
        return true
    }

    override fun run() {
        initEgl()
        batch.create(Config.W.toFloat(), Config.H.toFloat())
        atlas.load(context)
        if (autoplaySeconds > 0 || killPlayer) {
            sim.beginAutoplay(autoplaySeconds.toDouble(), killPlayer)
        }

        var last = System.nanoTime()
        while (running) {
            if (paused) {
                SystemClock.sleep(8)
                last = System.nanoTime()
                continue
            }
            val frameStart = System.nanoTime()
            val rawMs = (frameStart - last) / 1_000_000.0
            last = frameStart

            val dt = kotlin.math.min(rawMs / 1000.0, Config.MAX_DT)
            drawClock += dt
            sim.advance(rawMs)
            fx.update(dt)

            GLES20.glViewport(0, 0, viewW, viewH)
            GLES20.glClearColor(0f, 0f, 0f, 1f)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
            GLES20.glViewport(
                offX.toInt(), offY.toInt(),
                (Config.W * scale).toInt(), (Config.H * scale).toInt()
            )
            drawScene()
            // Make the driver take the command stream before the clock stops, so
            // cpu_ms covers the same span the ADR measured.
            GLES20.glFlush()
            val cpuEnd = System.nanoTime()

            EGL14.eglSwapBuffers(display, eglSurface)
            val frameEnd = System.nanoTime()
            metrics.onFrameEnd(frameStart, cpuEnd, frameEnd, processStartNanos)
            frames++

            // Bookkeeping lives after the present so it cannot inflate cpu_ms.
            if (metrics.done && !dumped) {
                dumped = true
                metrics.dump(
                    context,
                    mapOf("surface" to "SurfaceView+EGL/GLES20", "draw_calls" to drawCalls.toString())
                )
            }
            maybeEmitState(frameEnd)
        }
        releaseEgl()
    }

    private fun maybeEmitState(nowNanos: Long) {
        val modeChanged = sim.mode != lastMode
        val deadline = sim.consumeAutoplayDeadline()
        if (!modeChanged && !deadline && nowNanos - lastEmitNanos < DebugState.EMIT_INTERVAL_NANOS) return
        lastMode = sim.mode
        lastEmitNanos = nowNanos
        debug.emit(
            sim.modeText, sim.score, sim.lives, sim.kills, sim.shotsFired,
            sim.enemyCount, sim.bulletCount, sim.playerX, sim.playerY, drawCalls, frames
        )
    }

    // ------------------------------------------------------------------ draw --

    private fun drawScene() {
        val shakeX = fx.shakeX()
        val shakeY = fx.shakeY()
        batch.begin()

        drawCity(shakeX, shakeY)
        drawClouds(shakeX, shakeY)

        if (sim.mode == GameSim.MODE_PLAY) {
            drawBullets(shakeX, shakeY)
            drawEnemies(shakeX, shakeY)
            drawPlayer(shakeX, shakeY)
            drawAdditive(shakeX, shakeY)
            drawSmoke(shakeX, shakeY)
            drawHud()
        } else {
            drawPlayer(shakeX, shakeY)
            drawAdditive(shakeX, shakeY)
            drawOverlay()
        }

        batch.end()
        drawCalls = batch.drawCalls
    }

    /**
     * The A/B tile pair, stacked so the same photograph never repeats back to back.
     * Each tile is drawn slightly larger than the screen and slid against the
     * drone's position -- that shift is where the sense of a camera angle comes
     * from. There are no building sprites: putting them over a real photograph once
     * produced buildings that floated.
     */
    private fun drawCity(shakeX: Float, shakeY: Float) {
        val zoom = Config.PARALLAX.tileZoom
        val zw = (Config.W * zoom).toFloat()
        val zh = (Config.H * zoom).toFloat()
        val padX = (zw - Config.W.toFloat()) * 0.5f
        val padY = (zh - Config.H.toFloat()) * 0.5f
        val norm = ((sim.playerX - Config.W / 2.0) / (Config.W / 2.0)).toFloat()
        val x = -padX - norm * Config.PARALLAX.cityShift.toFloat() + shakeX

        val period = Config.H * 2.0
        val off = ((sim.cityDist % period) + period) % period
        // A, B, A, B down the loop, in that order. The tiles are drawn taller than
        // their step, so they overlap by the zoom margin and the later tile has to
        // cover the earlier one -- grouping the two textures into two passes would
        // invert that at every second seam and draw a visible band. At most three
        // tiles are on screen, so this costs three binds, not the 114-call blow-up
        // ADR-001 measured for ungrouped batching.
        for (k in -1..2) {
            for (i in 0 until 2) {
                val yTop = off + k * period + i * Config.H
                if (yTop > Config.H || yTop + Config.H < 0) continue
                val tex = if (i == 0) atlas.cityA else atlas.cityB
                batch.draw(tex, x, (yTop - padY).toFloat() + shakeY, zw, zh)
            }
        }
    }

    /**
     * The cloud layer. Alpha and scale are drawn per slot from the LCG across the
     * whole `alphaMin..alphaMax` / `scaleMin..scaleMax` range, not pinned at the
     * minimum: the web build varies them per cloud, and a layer stuck at 0.28 is a
     * different -- thinner -- background than the one the contrast work measures
     * against. Slot values are rolled once at construction, so the draw loop stays
     * allocation-free and the layout is deterministic.
     */
    private fun drawClouds(shakeX: Float, shakeY: Float) {
        val n = cloudSlots
        val span = Config.H + Config.CLOUDS.spacing
        val scroll = sim.cityDist * (Config.CLOUDS.speed / Config.SCROLL.speed)
        for (k in 0 until n) {
            val id = if (k % 2 == 0) Sprite.CLOUD_WISP else Sprite.CLOUD_PUFF
            val y = ((scroll + k * Config.CLOUDS.spacing) % span) - Config.CLOUDS.spacing
            // drawW/drawH, not width/height: assets are stored at 2x their draw
            // size, so the texel size would put a 512px wisp on a 480px screen.
            val w = atlas.drawW(id) * cloudScale[k].toFloat()
            val h = atlas.drawH(id) * cloudScale[k].toFloat()
            val lane = (k + 1) * Config.W / (n + 1)
            val cx = (lane + cloudShift[k] * Config.CLOUDS.hShift).toFloat() - w * 0.5f
            batch.drawRegion(
                atlas.texture, cx + shakeX, y.toFloat() + shakeY, w, h,
                atlas.u0(id), atlas.v0(id), atlas.u1(id), atlas.v1(id),
                1f, 1f, 1f, cloudAlpha[k].toFloat()
            )
        }
    }

    private fun drawBullets(shakeX: Float, shakeY: Float) {
        val w = Config.BULLET.w.toFloat()
        val h = Config.BULLET.h.toFloat()
        val id = Sprite.WHITE
        val u0 = atlas.u0(id); val v0 = atlas.v0(id)
        val u1 = atlas.u1(id); val v1 = atlas.v1(id)
        // Discrete tracer: cyan sheath with a white core, parallel -- never a fan.
        for (i in sim.bulletActive.indices) {
            if (!sim.bulletActive[i]) continue
            val x = sim.bulletX[i].toFloat() + shakeX
            val y = sim.bulletY[i].toFloat() + shakeY
            batch.drawRegion(atlas.texture, x - w * 0.5f, y, w, h * 1.6f, u0, v0, u1, v1,
                0.21f, 0.84f, 1f, 0.85f)
            batch.drawRegion(atlas.texture, x - w * 0.22f, y + h * 0.25f, w * 0.44f, h, u0, v0, u1, v1,
                1f, 1f, 1f, 1f)
        }
        for (i in sim.ebulletActive.indices) {
            if (!sim.ebulletActive[i]) continue
            val x = sim.ebulletX[i].toFloat() + shakeX
            val y = sim.ebulletY[i].toFloat() + shakeY
            batch.drawRegion(atlas.texture, x - w * 0.6f, y - w * 0.6f, w * 1.2f, w * 1.2f,
                u0, v0, u1, v1, 1f, 0.42f, 0.24f, 1f)
        }
    }

    /** Sprites are drawn at the hit diameter, so what is seen is what is hit. */
    private fun drawEnemies(shakeX: Float, shakeY: Float) {
        for (kind in 0 until GameSim.KIND_COUNT) {
            val id = enemySprite[kind]
            val u0 = atlas.u0(id); val v0 = atlas.v0(id)
            val u1 = atlas.u1(id); val v1 = atlas.v1(id)
            val size = (enemyRadius[kind] * 2.0).toFloat()
            for (i in sim.enemyActive.indices) {
                if (!sim.enemyActive[i] || sim.enemyKind[i] != kind) continue
                batch.drawRotatedRegion(
                    atlas.texture, sim.enemyX[i].toFloat() + shakeX, sim.enemyY[i].toFloat() + shakeY,
                    size, size, 0f, u0, v0, u1, v1, 1f, 1f, 1f, 1f
                )
            }
        }
    }

    private fun drawPlayer(shakeX: Float, shakeY: Float) {
        val id = Sprite.PLAYER
        val size = Config.PLAYER.size.toFloat()
        val bank = (sim.playerVx * 0.035).toFloat().coerceIn(-BANK_MAX_DEG, BANK_MAX_DEG) * DEG_TO_RAD
        // Invincibility blink is drawing: the sim never reads this alpha.
        val a = if (sim.invincible && ((drawClock * 12.0).toInt() and 1) == 1) 0.35f else 1f
        batch.drawRotatedRegion(
            atlas.texture, sim.playerX.toFloat() + shakeX, sim.playerY.toFloat() + shakeY,
            size, size, bank,
            atlas.u0(id), atlas.v0(id), atlas.u1(id), atlas.v1(id), 1f, 1f, 1f, a
        )
    }

    /**
     * Everything additive in one pass: muzzle flash, rotor arcs, sparks and the two
     * bright explosion layers. One texture, one blend mode, one draw call.
     */
    private fun drawAdditive(shakeX: Float, shakeY: Float) {
        val add = SpriteBatch.BLEND_ADD

        if (sim.muzzleT > 0.0 && sim.mode == GameSim.MODE_PLAY) {
            val id = Sprite.MUZZLE
            val k = (sim.muzzleT / (Config.FIRE.muzzleMs / 1000.0)).toFloat()
            val s = Config.PLAYER.half.toFloat() * 0.9f
            batch.drawRegion(
                atlas.texture,
                sim.playerX.toFloat() - s * 0.5f + shakeX,
                sim.playerY.toFloat() - Config.PLAYER.half.toFloat() - s * 0.6f + shakeY,
                s, s, atlas.u0(id), atlas.v0(id), atlas.u1(id), atlas.v1(id),
                1f, 0.95f, 0.7f, k, add
            )
        }

        val spin = (drawClock * Config.ROTOR.speed).toFloat()
        drawRotors(
            rotorPlayer, sim.playerX, sim.playerY, Config.ROTOR.radii.drone_player,
            1.0, spin, shakeX, shakeY
        )
        if (sim.mode == GameSim.MODE_PLAY) {
            // Hit flash: the body again, additively, for as long as the sim says the
            // flash lasts. A tint parameter, never a second pre-baked bitmap -- the
            // per-size bitmap cache is banned and this is why it is not needed.
            val flashLen = Config.FX.hitFlashMs / 1000.0
            for (i in sim.enemyActive.indices) {
                if (!sim.enemyActive[i] || sim.enemyFlash[i] <= 0.0) continue
                val kind = sim.enemyKind[i]
                val id = enemySprite[kind]
                val size = (enemyRadius[kind] * 2.0).toFloat()
                val a = (sim.enemyFlash[i] / flashLen).toFloat().coerceIn(0f, 1f)
                drawCentered(
                    id, sim.enemyX[i].toFloat() + shakeX, sim.enemyY[i].toFloat() + shakeY,
                    size, 1f, 1f, 1f, a, add
                )
            }
            for (i in sim.enemyActive.indices) {
                if (!sim.enemyActive[i]) continue
                val kind = sim.enemyKind[i]
                val table = when (kind) {
                    GameSim.KIND_GUNNER -> rotorGunner
                    GameSim.KIND_SHIELD -> rotorShield
                    else -> rotorScout
                }
                drawRotors(
                    table, sim.enemyX[i], sim.enemyY[i], enemyRotorRadius[kind],
                    1.0, spin + i, shakeX, shakeY
                )
            }
        }

        val wid = Sprite.WHITE
        for (i in 0 until fx.sparkCap) {
            if (!fx.spActive[i]) continue
            val a = (fx.spLife[i] / fx.spLife0[i]).toFloat().coerceIn(0f, 1f)
            batch.drawRegion(
                atlas.texture, fx.spX[i].toFloat() - 2.5f + shakeX, fx.spY[i].toFloat() - 2.5f + shakeY,
                5f, 5f, atlas.u0(wid), atlas.v0(wid), atlas.u1(wid), atlas.v1(wid),
                1f, 0.76f, 0.29f, a, add
            )
        }

        val flashLife = Config.FX.flashMs / 1000.0
        val fireLife = Config.FX.fireMs / 1000.0
        for (i in 0 until fx.explosionCap) {
            if (!fx.exActive[i]) continue
            val t = fx.exT[i]
            val x = fx.exX[i].toFloat() + shakeX
            val y = fx.exY[i].toFloat() + shakeY
            val base = (Config.FX.shockMaxR * 2.0 * fx.exScale[i]).toFloat()
            if (t < flashLife) {
                val k = (t / flashLife).toFloat()
                val s = base * (0.4f + 1.6f * k)
                drawCentered(Sprite.BOOM_FLASH, x, y, s, 1f, 1f, 1f, 1f - k, add)
            }
            if (t < fireLife) {
                val k = (t / fireLife).toFloat()
                val s = base * (0.55f + 1.55f * k)
                val a = Math.pow((1.0 - k).toDouble(), 2.8).toFloat()
                drawCentered(Sprite.BOOM_FIRE, x, y, s, 1f, 1f, 1f, a, add)
            }
        }

        if (sim.mode == GameSim.MODE_PLAY) drawLives(add)
    }

    /**
     * Lives, as glowing drone icons. Drawn additively because the drone art is dark
     * and a multiplied tint can only ever make it darker -- against the night city
     * the readout would be invisible, which is how it first came out.
     */
    private fun drawLives(add: Int) {
        val id = Sprite.PLAYER
        val pad = 12f
        val s = 26f
        for (i in 0 until sim.lives) {
            batch.drawRegion(
                atlas.texture, Config.W.toFloat() - pad - (i + 1) * (s + 4f), pad, s, s,
                atlas.u0(id), atlas.v0(id), atlas.u1(id), atlas.v1(id),
                0.7f, 1f, 1f, 1f, add
            )
        }
    }

    private fun drawSmoke(shakeX: Float, shakeY: Float) {
        val delay = Config.FX.smokeDelay
        val life = Config.FX.smokeMs / 1000.0
        for (i in 0 until fx.explosionCap) {
            if (!fx.exActive[i]) continue
            val t = fx.exT[i] - delay
            if (t < 0.0 || t > life) continue
            val k = (t / life).toFloat()
            val base = (Config.FX.shockMaxR * 2.0 * fx.exScale[i]).toFloat()
            val s = base * (0.8f + 1.4f * k)
            val a = Config.FX.smokeMaxAlpha.toFloat() * (1f - k)
            drawCentered(
                Sprite.BOOM_SMOKE, fx.exX[i].toFloat() + shakeX,
                fx.exY[i].toFloat() - k * 20f + shakeY, s, 1f, 1f, 1f, a, SpriteBatch.BLEND_NORMAL
            )
        }
    }

    private fun drawCentered(
        id: Int, cx: Float, cy: Float, size: Float,
        r: Float, g: Float, b: Float, a: Float, blend: Int
    ) {
        if (a <= 0f) return
        batch.drawRegion(
            atlas.texture, cx - size * 0.5f, cy - size * 0.5f, size, size,
            atlas.u0(id), atlas.v0(id), atlas.u1(id), atlas.v1(id), r, g, b, a, blend
        )
    }

    private fun drawRotors(
        table: DoubleArray, cx: Double, cy: Double, radius: Double,
        scaleMul: Double, spin: Float, shakeX: Float, shakeY: Float
    ) {
        val id = Sprite.RING
        val u0 = atlas.u0(id); val v0 = atlas.v0(id)
        val u1 = atlas.u1(id); val v1 = atlas.v1(id)
        val r = (radius * scaleMul).toFloat()
        var k = 0
        while (k < table.size) {
            val x = (cx + table[k] * scaleMul).toFloat() + shakeX
            val y = (cy + table[k + 1] * scaleMul).toFloat() + shakeY
            batch.drawRotatedRegion(
                atlas.texture, x, y, r * 2f, r * 2f, spin + k,
                u0, v0, u1, v1, 0.75f, 0.94f, 1f, Config.ROTOR.blurAlpha.toFloat() * 3f,
                SpriteBatch.BLEND_ADD
            )
            k += 2
        }
    }

    // ------------------------------------------------------------------- hud --

    private fun drawHud() {
        val pad = 12f
        text("SKOR", pad, pad, 20f, 0.72f, 0.88f, 1f, 0.9f)
        drawInt(sim.score, pad, pad + 22f, 26f, 1f, 1f, 1f, 1f)
    }

    private fun drawOverlay() {
        val wid = Sprite.WHITE
        batch.drawRegion(
            atlas.texture, 0f, 0f, Config.W.toFloat(), Config.H.toFloat(),
            atlas.u0(wid), atlas.v0(wid), atlas.u1(wid), atlas.v1(wid), 0f, 0.02f, 0.06f, 0.62f
        )
        if (sim.mode == GameSim.MODE_OVER) {
            centered("OYUN BITTI", Config.H.toFloat() * 0.34f, 38f, 1f, 0.42f, 0.38f, 1f)
            centered("SKOR", Config.H.toFloat() * 0.46f, 22f, 0.72f, 0.88f, 1f, 0.9f)
            centeredInt(sim.score, Config.H.toFloat() * 0.51f, 34f, 1f, 1f, 1f, 1f)
            centered("DOKUN VE TEKRAR BASLA", Config.H.toFloat() * 0.64f, 18f, 0.8f, 0.9f, 1f, 0.85f)
        } else {
            centered("DRONE WAR", Config.H.toFloat() * 0.3f, 42f, 0.65f, 0.9f, 1f, 1f)
            centered("ISTANBUL", Config.H.toFloat() * 0.38f, 20f, 0.75f, 0.8f, 0.9f, 0.8f)
            centered("DOKUN VE BASLA", Config.H.toFloat() * 0.56f, 22f, 1f, 1f, 1f, 0.95f)
            centered("PARMAGINI SURUKLE", Config.H.toFloat() * 0.62f, 15f, 0.7f, 0.85f, 1f, 0.75f)
            centered("DRON TAKIP EDER", Config.H.toFloat() * 0.66f, 15f, 0.7f, 0.85f, 1f, 0.75f)
        }
    }

    private fun text(s: String, x: Float, y: Float, size: Float, r: Float, g: Float, b: Float, a: Float) {
        var cx = x
        for (i in s.indices) {
            val cell = atlas.cellOf(s[i])
            if (cell != 0) {
                batch.drawRegion(
                    atlas.texture, cx, y, size, size,
                    atlas.glyphU0(cell), atlas.glyphV0(cell), atlas.glyphU1(cell), atlas.glyphV1(cell),
                    r, g, b, a
                )
            }
            cx += size * TEXT_ADVANCE
        }
    }

    private fun centered(s: String, y: Float, size: Float, r: Float, g: Float, b: Float, a: Float) {
        text(s, (Config.W.toFloat() - s.length * size * TEXT_ADVANCE) * 0.5f, y, size, r, g, b, a)
    }

    /** Integer to glyphs without allocating a String in the frame loop. */
    private fun drawInt(value: Int, x: Float, y: Float, size: Float, r: Float, g: Float, b: Float, a: Float) {
        val n = formatInt(value)
        var cx = x
        for (i in numBuf.size - n until numBuf.size) {
            val cell = atlas.cellOf(numBuf[i])
            batch.drawRegion(
                atlas.texture, cx, y, size, size,
                atlas.glyphU0(cell), atlas.glyphV0(cell), atlas.glyphU1(cell), atlas.glyphV1(cell),
                r, g, b, a
            )
            cx += size * TEXT_ADVANCE
        }
    }

    private fun centeredInt(value: Int, y: Float, size: Float, r: Float, g: Float, b: Float, a: Float) {
        val n = formatInt(value)
        drawInt(value, (Config.W.toFloat() - n * size * TEXT_ADVANCE) * 0.5f, y, size, r, g, b, a)
    }

    /** Fills [numBuf] from the right and returns how many digits it wrote. */
    private fun formatInt(value: Int): Int {
        var v = if (value < 0) 0 else value
        var i = numBuf.size
        if (v == 0) {
            numBuf[--i] = '0'
            return 1
        }
        while (v > 0 && i > 0) {
            numBuf[--i] = ('0' + (v % 10))
            v /= 10
        }
        return numBuf.size - i
    }

    // ------------------------------------------------------------------- egl --

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
}
