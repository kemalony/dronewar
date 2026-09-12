package dev.dronewar.game

import dev.dronewar.rules.Config
import dev.dronewar.sim.Lcg
import dev.dronewar.sim.Sim

/**
 * The playable slice's simulation: spawning, firing, enemies, collisions, score and
 * lives. Fixed step, allocation-free, no wall clock.
 *
 * Two rules shape this file:
 *
 *  - **The player is not simulated here.** Position and velocity come from
 *    `:core-sim`'s [Sim], including the 1:1 touch branch. There is no second player
 *    integrator in the app; this class only tells [Sim] where the finger is.
 *  - **Every gameplay number comes from `:rules`.** Speeds, intervals, pool sizes,
 *    scores and radii are read from [Config]; nothing is restated here.
 *
 * Scope is the vertical slice: stage 1 (Istanbul), three enemy types, straight
 * descent with a horizontal sway. Written debt, not hidden: this is a playability
 * demonstration and the parity gate does not cover it.
 */
class GameSim(private val fx: Fx) {

    companion object {
        const val MODE_MENU = 0
        const val MODE_PLAY = 1
        const val MODE_OVER = 2

        const val KIND_SCOUT = 0
        const val KIND_GUNNER = 1
        const val KIND_SHIELD = 2
        const val KIND_COUNT = 3

        private const val TAU = 6.283185307179586

        /** Debug harness only -- how long `--ez killplayer true` waits, in seconds. */
        private const val KILL_PLAYER_DELAY_S = 3.0

        /** Debug harness only -- seconds per sweep of the scripted autoplay finger. */
        private const val AUTOPLAY_SWEEP_S = 2.6

        /** Seed for the spawn stream; the run is reproducible from it. */
        private const val SPAWN_SEED = 1234567

        private fun modeName(m: Int) = when (m) {
            MODE_PLAY -> "play"
            MODE_OVER -> "over"
            else -> "menu"
        }
    }

    private val sim = Sim()
    private val rng = Lcg(SPAWN_SEED)

    // ---- enemy tables, read straight out of :rules ---------------------------
    private val kindSpeed = doubleArrayOf(
        Config.ENEMIES.scout.speed, Config.ENEMIES.gunner.speed, Config.ENEMIES.shield.speed
    )
    private val kindHp = doubleArrayOf(
        Config.ENEMIES.scout.hp, Config.ENEMIES.gunner.hp, Config.ENEMIES.shield.hp
    )
    private val kindScore = doubleArrayOf(
        Config.ENEMIES.scout.score, Config.ENEMIES.gunner.score, Config.ENEMIES.shield.score
    )
    private val kindRadius = doubleArrayOf(
        Config.ENEMIES.scout.radius, Config.ENEMIES.gunner.radius, Config.ENEMIES.shield.radius
    )

    // ---- pools: struct of arrays, sized from :rules, never reallocated --------
    private val enemyCap = Config.STAGES._0.maxConcurrent.toInt()
    val enemyActive = BooleanArray(enemyCap)
    val enemyKind = IntArray(enemyCap)
    val enemyX = DoubleArray(enemyCap)
    val enemyY = DoubleArray(enemyCap)
    private val enemyHomeX = DoubleArray(enemyCap)
    private val enemySwayT = DoubleArray(enemyCap)
    private val enemyHp = DoubleArray(enemyCap)
    private val enemyFireT = DoubleArray(enemyCap)
    val enemyFlash = DoubleArray(enemyCap)

    private val bulletCap = Config.FIRE.pool.toInt()
    val bulletActive = BooleanArray(bulletCap)
    val bulletX = DoubleArray(bulletCap)
    val bulletY = DoubleArray(bulletCap)
    private val bulletLife = DoubleArray(bulletCap)

    private val ebulletCap = Config.ENEMY_BULLET_POOL.toInt()
    val ebulletActive = BooleanArray(ebulletCap)
    val ebulletX = DoubleArray(ebulletCap)
    val ebulletY = DoubleArray(ebulletCap)
    private val ebulletVx = DoubleArray(ebulletCap)
    private val ebulletVy = DoubleArray(ebulletCap)
    private val ebulletLife = DoubleArray(ebulletCap)

    // ---- run state -----------------------------------------------------------
    var mode = MODE_MENU; private set
    var score = 0; private set
    var lives = Config.PLAYER_LIVES.toInt(); private set
    var kills = 0; private set
    var shotsFired = 0; private set
    var modeSeq = 0; private set

    /** Muzzle-flash countdown; draw-only, but it is the firing event that sets it. */
    var muzzleT = 0.0; private set

    private var fireTimer = 0.0
    private var spawnTimer = 0.0
    private var invincibleT = 0.0
    private var playTime = 0.0
    private var fingerDown = false

    /** Background scroll distance in world px. Draw reads it; nothing else does. */
    var cityDist = 0.0; private set

    val playerX: Double get() = sim.playerX
    val playerY: Double get() = sim.playerY
    val playerVx: Double get() = sim.playerVx
    val playerVy: Double get() = sim.playerVy
    val invincible: Boolean get() = invincibleT > 0.0
    val modeText: String get() = modeName(mode)

    val enemyCount: Int get() = countTrue(enemyActive)
    val bulletCount: Int get() = countTrue(bulletActive) + countTrue(ebulletActive)

    private fun countTrue(flags: BooleanArray): Int {
        var n = 0
        for (i in flags.indices) if (flags[i]) n++
        return n
    }

    // ---- pointer, handed over from the UI thread -----------------------------
    //
    // Touch arrives on the UI thread and the sim runs on the render thread, so the
    // pointer is published through volatile fields and consumed once per frame on
    // the render thread. Nothing here writes sim state from two threads.

    @Volatile private var pointerX = 0.0
    @Volatile private var pointerY = 0.0
    @Volatile private var pointerDown = false
    @Volatile private var downSeq = 0
    private var consumedDownSeq = 0

    private var autoplay = false
    private var autoplaySeconds = 0.0
    private var autoplayReported = false
    private var killPlayerRequested = false

    fun onPointerDown(x: Double, y: Double) {
        pointerX = x
        pointerY = y
        pointerDown = true
        downSeq++
    }

    fun onPointerMove(x: Double, y: Double) {
        pointerX = x
        pointerY = y
    }

    fun onPointerUp() {
        pointerDown = false
    }

    /** Debug entry point: skip the menu and drive a scripted finger. */
    fun beginAutoplay(seconds: Double, killPlayer: Boolean) {
        autoplay = true
        autoplaySeconds = seconds
        killPlayerRequested = killPlayer
        startGame()
    }

    /** True exactly once, on the frame the scripted run reaches its deadline. */
    fun consumeAutoplayDeadline(): Boolean {
        if (!autoplay || autoplayReported || playTime < autoplaySeconds) return false
        autoplayReported = true
        return true
    }

    private fun startGame() {
        sim.reset()
        rng.reseed(SPAWN_SEED)
        score = 0
        kills = 0
        shotsFired = 0
        lives = Config.PLAYER_LIVES.toInt()
        fireTimer = 0.0
        spawnTimer = 0.0
        invincibleT = 0.0
        playTime = 0.0
        muzzleT = 0.0
        fingerDown = false
        java.util.Arrays.fill(enemyActive, false)
        java.util.Arrays.fill(bulletActive, false)
        java.util.Arrays.fill(ebulletActive, false)
        fx.clear()
        setMode(MODE_PLAY)
    }

    private fun setMode(m: Int) {
        if (mode == m) return
        mode = m
        modeSeq++
        // A scripted run hands control back when it ends. Without this, `autoplay`
        // stayed true forever and the tap-to-start branch below (guarded by
        // !autoplay) never fired again: the app sat on the game-over screen and
        // ignored every touch. Anyone who had once launched it with
        // `--ei autoplay` had a permanently deaf build, with no crash and the
        // render loop still ticking, so nothing looked wrong.
        if (m == MODE_OVER) autoplay = false
    }

    /**
     * Advances by `rawMs` of wall time. The wall clock stops at this boundary: the
     * sim itself sees only the fixed `dt` [Sim] hands out.
     */
    fun advance(rawMs: Double) {
        val tapped = downSeq != consumedDownSeq
        if (tapped) consumedDownSeq = downSeq

        if (!autoplay && tapped && (mode == MODE_MENU || mode == MODE_OVER)) {
            startGame()
            // The gesture that started the run also begins tracking, so the very
            // first drag moves the drone instead of being swallowed by the menu.
            sim.touchMove(pointerX, pointerY)
            fingerDown = true
        }

        if (mode != MODE_PLAY) {
            // Menu and game-over still scroll the city, but no sim step runs.
            cityDist += Config.SCROLL.speed * rawMs / 1000.0
            return
        }

        if (autoplay) {
            driveAutoplay()
        } else if (pointerDown) {
            sim.touchMove(pointerX, pointerY)
            fingerDown = true
        } else if (fingerDown) {
            sim.touchRelease()
            fingerDown = false
        }

        val dt = sim.stepSeconds
        val steps = sim.advance(rawMs)
        var i = 0
        while (i < steps) {
            stepWorld(dt)
            i++
        }
    }

    /**
     * The scripted finger. It sweeps the full width so bullets and descending
     * enemies actually meet, and it is only ever applied while the run is live, so
     * a forced game over stays a game over.
     */
    private fun driveAutoplay() {
        val half = Config.PLAYER.half
        val phase = playTime * TAU / AUTOPLAY_SWEEP_S
        val tx = Config.W / 2.0 + kotlin.math.sin(phase) * (Config.W / 2.0 - half)
        val ty = Config.H * 0.78
        sim.touchMove(tx, ty)
        fingerDown = true
    }

    private fun stepWorld(dt: Double) {
        playTime += dt
        cityDist += Config.SCROLL.speed * dt
        if (muzzleT > 0.0) muzzleT -= dt
        if (invincibleT > 0.0) invincibleT -= dt

        if (killPlayerRequested && playTime >= KILL_PLAYER_DELAY_S) {
            killPlayerRequested = false
            lives = 0
            fx.explode(sim.playerX, sim.playerY, true)
            setMode(MODE_OVER)
            return
        }

        stepFiring(dt)
        stepBullets(dt)
        stepSpawn(dt)
        stepEnemies(dt)
        stepEnemyBullets(dt)
        collideBullets()
        collideBodies()
    }

    private fun stepFiring(dt: Double) {
        if (!fingerDown) return
        fireTimer -= dt
        while (fireTimer <= 0.0) {
            fireTimer += Config.WEAPON.levels._0.interval
            val i = freeSlot(bulletActive)
            if (i >= 0) {
                bulletActive[i] = true
                bulletX[i] = sim.playerX
                bulletY[i] = sim.playerY - Config.PLAYER.half
                bulletLife[i] = Config.BULLET.life
                shotsFired++
                muzzleT = Config.FIRE.muzzleMs / 1000.0
            }
        }
    }

    private fun stepBullets(dt: Double) {
        for (i in 0 until bulletCap) {
            if (!bulletActive[i]) continue
            bulletY[i] -= Config.BULLET.speed * dt
            bulletLife[i] -= dt
            if (bulletLife[i] <= 0.0 || bulletY[i] < -Config.BULLET.h) bulletActive[i] = false
        }
    }

    private fun stepSpawn(dt: Double) {
        spawnTimer -= dt * 1000.0
        if (spawnTimer > 0.0) return
        val slot = freeSlot(enemyActive)
        if (slot < 0) {
            // Pool full is the concurrency cap; retry on the next step rather than
            // burning the interval and leaving the sky empty afterwards.
            spawnTimer = dt * 1000.0
            return
        }
        spawnTimer =
            (Config.SPAWN.base + rng.nextDouble() * Config.SPAWN.variance) * Config.STAGES._0.spawnMul

        var kind = (rng.nextDouble() * KIND_COUNT).toInt()
        if (kind >= KIND_COUNT) kind = KIND_COUNT - 1
        val r = kindRadius[kind]
        val x = r + rng.nextDouble() * (Config.W - 2.0 * r)

        enemyActive[slot] = true
        enemyKind[slot] = kind
        enemyX[slot] = x
        enemyHomeX[slot] = x
        enemyY[slot] = -r
        enemySwayT[slot] = rng.nextDouble()
        enemyHp[slot] = kindHp[kind]
        enemyFlash[slot] = 0.0
        enemyFireT[slot] = Config.STAGES._0.gunnerFireMs / 1000.0
    }

    private fun stepEnemies(dt: Double) {
        val speedMul = Config.STAGES._0.enemySpeedMul
        for (i in 0 until enemyCap) {
            if (!enemyActive[i]) continue
            val kind = enemyKind[i]
            val r = kindRadius[kind]

            enemyY[i] += kindSpeed[kind] * speedMul * dt
            // Horizontal sway. The amplitude and rate are the wave the :rules table
            // already defines for a laterally moving drone; no new constant.
            enemySwayT[i] += dt
            val sway = kotlin.math.sin(enemySwayT[i] * TAU * Config.SKIMMER.waveHz) * Config.SKIMMER.waveAmp
            var x = enemyHomeX[i] + sway
            if (x < r) x = r
            if (x > Config.W - r) x = Config.W - r
            enemyX[i] = x

            if (enemyFlash[i] > 0.0) enemyFlash[i] -= dt

            if (kind == KIND_GUNNER) {
                enemyFireT[i] -= dt
                if (enemyFireT[i] <= 0.0 && enemyY[i] > r && enemyY[i] < Config.H * 0.7) {
                    enemyFireT[i] = Config.STAGES._0.gunnerFireMs / 1000.0
                    fireAtPlayer(enemyX[i], enemyY[i] + r)
                }
            }

            if (enemyY[i] - r > Config.H) enemyActive[i] = false
        }
    }

    private fun fireAtPlayer(x: Double, y: Double) {
        val i = freeSlot(ebulletActive)
        if (i < 0) return
        val dx = sim.playerX - x
        val dy = sim.playerY - y
        var d = kotlin.math.sqrt(dx * dx + dy * dy)
        if (d <= 0.0) d = 1.0
        val sp = Config.STAGES._0.ebulletSpeed
        ebulletActive[i] = true
        ebulletX[i] = x
        ebulletY[i] = y
        ebulletVx[i] = dx / d * sp
        ebulletVy[i] = dy / d * sp
        ebulletLife[i] = Config.EBULLET.life
    }

    private fun stepEnemyBullets(dt: Double) {
        for (i in 0 until ebulletCap) {
            if (!ebulletActive[i]) continue
            ebulletX[i] += ebulletVx[i] * dt
            ebulletY[i] += ebulletVy[i] * dt
            ebulletLife[i] -= dt
            if (ebulletLife[i] <= 0.0 || ebulletY[i] > Config.H || ebulletY[i] < 0.0 ||
                ebulletX[i] < 0.0 || ebulletX[i] > Config.W
            ) ebulletActive[i] = false
        }
    }

    private fun collideBullets() {
        val br = Config.BULLET.w * 0.5
        for (b in 0 until bulletCap) {
            if (!bulletActive[b]) continue
            for (e in 0 until enemyCap) {
                if (!enemyActive[e]) continue
                val rr = br + kindRadius[enemyKind[e]]
                val dx = bulletX[b] - enemyX[e]
                val dy = bulletY[b] - enemyY[e]
                if (dx * dx + dy * dy > rr * rr) continue
                bulletActive[b] = false
                enemyHp[e] -= 1.0
                if (enemyHp[e] <= 0.0) {
                    enemyActive[e] = false
                    kills++
                    score += kindScore[enemyKind[e]].toInt()
                    fx.explode(enemyX[e], enemyY[e], false)
                } else {
                    enemyFlash[e] = Config.FX.hitFlashMs / 1000.0
                    fx.sparkBurst(bulletX[b], bulletY[b])
                }
                break
            }
        }
    }

    private fun collideBodies() {
        // The drone's collision radius. :rules has no player hit-rect table yet
        // (architecture section 5 puts one in `Hit.aabb` later); the rotor radius is
        // the closest thing it does define, and it matches the web's inline value.
        val pr = Config.ROTOR.radii.drone_player
        val px = sim.playerX
        val py = sim.playerY

        for (e in 0 until enemyCap) {
            if (!enemyActive[e]) continue
            val rr = pr + kindRadius[enemyKind[e]]
            val dx = px - enemyX[e]
            val dy = py - enemyY[e]
            if (dx * dx + dy * dy > rr * rr) continue
            enemyActive[e] = false
            fx.explode(enemyX[e], enemyY[e], false)
            takeHit()
            if (mode != MODE_PLAY) return
        }

        if (invincibleT > 0.0) return
        for (i in 0 until ebulletCap) {
            if (!ebulletActive[i]) continue
            val dx = px - ebulletX[i]
            val dy = py - ebulletY[i]
            if (dx * dx + dy * dy > pr * pr) continue
            ebulletActive[i] = false
            takeHit()
            if (mode != MODE_PLAY) return
        }
    }

    private fun takeHit() {
        if (invincibleT > 0.0) return
        invincibleT = Config.INVINCIBLE_MS / 1000.0
        lives--
        fx.explode(sim.playerX, sim.playerY, true)
        if (lives <= 0) {
            lives = 0
            setMode(MODE_OVER)
        }
    }

    private fun freeSlot(flags: BooleanArray): Int {
        for (i in flags.indices) if (!flags[i]) return i
        return -1
    }
}
