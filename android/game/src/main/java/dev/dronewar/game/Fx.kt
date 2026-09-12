package dev.dronewar.game

import dev.dronewar.rules.Config
import dev.dronewar.sim.Lcg

/**
 * Draw-only effects: explosions, sparks and screen shake.
 *
 * Nothing in this class is read back by [GameSim]. It is fed by the sim (an enemy
 * died here) and consumed by the renderer, and that is the whole of the contract --
 * the invariant the web build states as "shake, sway, glow and rotor spin are
 * drawing, they never change sim state".
 *
 * Pools are sized from `:rules` and never grow; the update loop allocates nothing.
 */
class Fx {

    companion object {
        private const val FX_SEED = 987654321
    }

    private val rng = Lcg(FX_SEED)

    private val exCap = Config.FX.wreck.pool.toInt()
    val exActive = BooleanArray(exCap)
    val exX = DoubleArray(exCap)
    val exY = DoubleArray(exCap)
    val exT = DoubleArray(exCap)
    val exScale = DoubleArray(exCap)

    private val spCap = Config.FX.sparkPool.toInt()
    val spActive = BooleanArray(spCap)
    val spX = DoubleArray(spCap)
    val spY = DoubleArray(spCap)
    private val spVx = DoubleArray(spCap)
    private val spVy = DoubleArray(spCap)
    val spLife = DoubleArray(spCap)
    val spLife0 = DoubleArray(spCap)

    private var shakeT = 0.0
    private var shakeDur = 0.0
    private var shakeAmp = 0.0

    val explosionCap: Int get() = exCap
    val sparkCap: Int get() = spCap

    /** Total explosion lifetime: smoke starts late and outlives the fire. */
    val explosionLife: Double =
        Config.FX.smokeDelay + Config.FX.smokeMs / 1000.0

    fun clear() {
        java.util.Arrays.fill(exActive, false)
        java.util.Arrays.fill(spActive, false)
        shakeT = 0.0
    }

    fun explode(x: Double, y: Double, player: Boolean) {
        val i = free(exActive)
        if (i >= 0) {
            exActive[i] = true
            exX[i] = x
            exY[i] = y
            exT[i] = 0.0
            exScale[i] = if (player) Config.SHAKE.bossAmp / Config.SHAKE.playerAmp else 1.0
        }
        val sparks = Config.FX.sparksPerExplosion.toInt()
        var k = 0
        while (k < sparks) {
            spawnSpark(x, y)
            k++
        }
        shakeDur = Config.SHAKE.playerHitMs / 1000.0
        shakeT = shakeDur
        shakeAmp = if (player) Config.SHAKE.bossAmp else Config.SHAKE.playerAmp
    }

    /** A bullet landed but did not kill: a few sparks, no explosion, no shake. */
    fun sparkBurst(x: Double, y: Double) {
        var k = 0
        val n = Config.FX.flak.sparks.toInt()
        while (k < n) {
            spawnSpark(x, y)
            k++
        }
    }

    private fun spawnSpark(x: Double, y: Double) {
        val i = free(spActive)
        if (i < 0) return
        val ang = rng.nextDouble() * 6.283185307179586
        val speed = Config.FX.sparkSpeedMin +
            rng.nextDouble() * (Config.FX.sparkSpeedMax - Config.FX.sparkSpeedMin)
        val life = Config.FX.sparkLifeMin +
            rng.nextDouble() * (Config.FX.sparkLifeMax - Config.FX.sparkLifeMin)
        spActive[i] = true
        spX[i] = x
        spY[i] = y
        spVx[i] = kotlin.math.cos(ang) * speed
        spVy[i] = kotlin.math.sin(ang) * speed
        spLife[i] = life
        spLife0[i] = life
    }

    fun update(dt: Double) {
        for (i in 0 until exCap) {
            if (!exActive[i]) continue
            exT[i] += dt
            if (exT[i] >= explosionLife) exActive[i] = false
        }
        for (i in 0 until spCap) {
            if (!spActive[i]) continue
            spX[i] += spVx[i] * dt
            spY[i] += spVy[i] * dt
            spLife[i] -= dt
            if (spLife[i] <= 0.0) spActive[i] = false
        }
        if (shakeT > 0.0) shakeT -= dt
    }

    /** Camera offset for this frame. Squared falloff, exactly as the web build. */
    fun shakeX(): Float = shakeOffset()

    fun shakeY(): Float = shakeOffset()

    private fun shakeOffset(): Float {
        if (shakeT <= 0.0 || shakeDur <= 0.0) return 0f
        val t = shakeT / shakeDur
        val amp = shakeAmp * t * t
        return ((rng.nextDouble() * 2.0 - 1.0) * amp).toFloat()
    }

    private fun free(flags: BooleanArray): Int {
        for (i in flags.indices) if (!flags[i]) return i
        return -1
    }
}
