package dev.dronewar.bench

/**
 * The frame_budget reference scene, shared by every platform candidate so the three
 * measurements compare the same work: 54 enemies, 96 bullets, 64 particles, 3 city
 * layers, one player. Simulation is fixed-step at 120 Hz and draws nothing.
 */
class Scene(seed: Int = 20260912) {

    companion object {
        const val W = 480f
        const val H = 800f
        const val STEP_HZ = 120
        const val STEP_S = 1f / STEP_HZ
        const val ENEMIES = 54
        const val BULLETS = 96
        const val PARTICLES = 64
        const val CITY_LAYERS = 3
        private const val MAX_FRAME_S = 1f / 30f
    }

    /** Sprite slot indices the renderers map onto their own texture tables. */
    object Sprite {
        const val CITY = 0
        const val PLAYER = 1
        const val SCOUT = 2
        const val GUNNER = 3
        const val SHIELD = 4
        const val BULLET = 5
        const val SPARK = 6
        const val BOOM = 7
        const val COUNT = 8
    }

    // Enemies: x, y, vx, vy, sprite slot, size, rotor phase.
    val enemyX = FloatArray(ENEMIES)
    val enemyY = FloatArray(ENEMIES)
    val enemyVx = FloatArray(ENEMIES)
    val enemyVy = FloatArray(ENEMIES)
    val enemySprite = IntArray(ENEMIES)
    val enemySize = FloatArray(ENEMIES)

    val bulletX = FloatArray(BULLETS)
    val bulletY = FloatArray(BULLETS)
    val bulletVy = FloatArray(BULLETS)

    val partX = FloatArray(PARTICLES)
    val partY = FloatArray(PARTICLES)
    val partVx = FloatArray(PARTICLES)
    val partVy = FloatArray(PARTICLES)
    val partLife = FloatArray(PARTICLES)

    /** City layer scroll offsets, back to front. */
    val cityY = FloatArray(CITY_LAYERS)
    private val citySpeed = floatArrayOf(34f, 78f, 150f)

    var playerX = W * 0.5f; private set
    var playerY = H * 0.78f; private set

    /** Where the finger wants the player to be. Set by the input layer. */
    var targetX = W * 0.5f
    var targetY = H * 0.78f

    var simTimeMs = 0.0; private set
    var steps = 0L; private set

    private val rng = Lcg(seed)
    private var accumulator = 0f

    init {
        for (i in 0 until ENEMIES) {
            enemyX[i] = rng.range(24f, W - 24f)
            enemyY[i] = rng.range(-200f, H * 0.6f)
            enemyVx[i] = rng.range(-40f, 40f)
            enemyVy[i] = rng.range(45f, 130f)
            enemySprite[i] = Sprite.SCOUT + (rng.nextInt() ushr 8 and 3).coerceAtMost(2)
            enemySize[i] = rng.range(38f, 62f)
        }
        for (i in 0 until BULLETS) {
            bulletX[i] = rng.range(0f, W)
            bulletY[i] = rng.range(0f, H)
            bulletVy[i] = -rng.range(620f, 760f)
        }
        for (i in 0 until PARTICLES) respawnParticle(i)
    }

    private fun respawnParticle(i: Int) {
        partX[i] = rng.range(0f, W)
        partY[i] = rng.range(0f, H)
        partVx[i] = rng.range(-120f, 120f)
        partVy[i] = rng.range(-160f, 60f)
        partLife[i] = rng.range(0.25f, 0.9f)
    }

    /**
     * Feeds wall-clock time into the fixed-step accumulator.
     * Returns how many sim steps ran, so callers can assert step counts in tests.
     */
    fun advance(rawDtSeconds: Float): Int {
        accumulator += if (rawDtSeconds > MAX_FRAME_S) MAX_FRAME_S else rawDtSeconds
        var ran = 0
        while (accumulator >= STEP_S) {
            step()
            accumulator -= STEP_S
            ran++
        }
        return ran
    }

    private fun step() {
        val dt = STEP_S

        for (i in 0 until CITY_LAYERS) {
            cityY[i] = (cityY[i] + citySpeed[i] * dt) % H
        }

        // The player tracks the finger 1:1 with a 2-step critically damped follow, so
        // touch_latency stays inside its budget without the position snapping.
        playerX += (targetX - playerX) * 0.55f
        playerY += (targetY - playerY) * 0.55f

        for (i in 0 until ENEMIES) {
            enemyX[i] += enemyVx[i] * dt
            enemyY[i] += enemyVy[i] * dt
            if (enemyX[i] < 20f || enemyX[i] > W - 20f) enemyVx[i] = -enemyVx[i]
            if (enemyY[i] > H + 60f) {
                enemyY[i] = -rng.range(40f, 260f)
                enemyX[i] = rng.range(24f, W - 24f)
            }
        }

        for (i in 0 until BULLETS) {
            bulletY[i] += bulletVy[i] * dt
            if (bulletY[i] < -30f) {
                bulletY[i] = H + rng.range(0f, 40f)
                bulletX[i] = rng.range(0f, W)
            }
        }

        for (i in 0 until PARTICLES) {
            partLife[i] -= dt
            if (partLife[i] <= 0f) {
                respawnParticle(i)
            } else {
                partX[i] += partVx[i] * dt
                partY[i] += partVy[i] * dt
                partVy[i] += 260f * dt
            }
        }

        steps++
        simTimeMs += STEP_S * 1000.0
    }

    /** Position digest used by the determinism and parity gates. */
    fun digest(): Long {
        var h = 1125899906842597L
        fun mix(v: Float) {
            h = h * 31 + java.lang.Float.floatToIntBits(v)
        }
        for (i in 0 until ENEMIES) { mix(enemyX[i]); mix(enemyY[i]) }
        for (i in 0 until BULLETS) { mix(bulletX[i]); mix(bulletY[i]) }
        mix(playerX); mix(playerY)
        return h
    }
}
