package dev.dronewar.game

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.opengl.GLES20
import android.opengl.GLUtils

/** Stable ids for everything the scene can draw. Indices into [Atlas]'s UV tables. */
object Sprite {
    const val PLAYER = 0
    const val SCOUT = 1
    const val GUNNER = 2
    const val SHIELD = 3
    const val BOOM_FLASH = 4
    const val BOOM_FIRE = 5
    const val BOOM_SMOKE = 6
    const val CLOUD_WISP = 7
    const val CLOUD_PUFF = 8

    /** Assets are stored at 2x their draw size; one definition of that rule. */
    const val ASSET_STORAGE_SCALE = 0.5f
    const val MUZZLE = 9
    const val TARGET = 10
    const val PU_WEAPON = 11
    const val PU_SHIELD = 12
    const val WHITE = 13
    const val RING = 14
    const val GLYPHS = 15
    const val COUNT = 16

    /** Asset file names; `null` means the entry is built procedurally at load. */
    val FILES = arrayOf(
        "drone_player", "drone_scout", "drone_gunner", "drone_shield",
        "boom_flash", "boom_fire", "boom_smoke",
        "cloud_wisp", "cloud_puff", "muzzle_flash", "hud_target",
        "pu_weapon", "pu_shield",
        null, null, null
    )
}

/**
 * Every small sprite in one texture, plus the two Istanbul city tiles kept separate
 * because they are 960x1600 each.
 *
 * One atlas is what keeps the frame inside the draw-call budget: with a single
 * texture bound, only a blend-mode change can force a flush, so the whole playfield
 * costs five calls. ADR-001 measured the alternative -- ungrouped batching took the
 * bench scene from 9 calls to 114 and made GL slower than Canvas.
 *
 * Loaded images are used wherever one exists; the two procedural entries (the 1x1
 * white quad and the rotor arc) are shapes, not artwork, and no new art is generated.
 */
class Atlas {

    companion object {
        private const val ATLAS_W = 1024
        private const val PAD = 2

        /** Glyph sheet geometry. Draw-only; nothing here is a gameplay constant. */
        const val GLYPH_COLS = 16
        const val GLYPH_CELL = 32
        const val CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:-!"

        /** One extra cell after the characters: a small drone for the lives readout. */
        val LIFE_ICON_INDEX = CHARS.length
        private val GLYPH_CELLS = CHARS.length + 1
        private val GLYPH_ROWS = (GLYPH_CELLS + GLYPH_COLS - 1) / GLYPH_COLS
    }

    var texture = 0; private set
    var cityA = 0; private set
    var cityB = 0; private set

    private val u0 = FloatArray(Sprite.COUNT)
    private val v0 = FloatArray(Sprite.COUNT)
    private val u1 = FloatArray(Sprite.COUNT)
    private val v1 = FloatArray(Sprite.COUNT)
    private val pxW = FloatArray(Sprite.COUNT)
    private val pxH = FloatArray(Sprite.COUNT)

    /** Per-character UVs, so a glyph run costs no lookups beyond an array index. */
    private val gu0 = FloatArray(GLYPH_CELLS + 1)
    private val gv0 = FloatArray(GLYPH_CELLS + 1)
    private val gu1 = FloatArray(GLYPH_CELLS + 1)
    private val gv1 = FloatArray(GLYPH_CELLS + 1)
    private val charIndex = IntArray(128)

    fun u0(id: Int) = u0[id]
    fun v0(id: Int) = v0[id]
    fun u1(id: Int) = u1[id]
    fun v1(id: Int) = v1[id]
    /** Texel size of the sprite in the atlas. Rarely what a draw call wants. */
    fun width(id: Int) = pxW[id]
    fun height(id: Int) = pxH[id]

    /**
     * Size the sprite is meant to be DRAWN at, in the 480x800 logical space.
     *
     * Every asset in this project is stored at twice its draw size -- see the
     * `source` field next to `width`/`height` in assets/manifest.json, and the
     * note in tools/gen_cities.py. Drawing a sprite at its texel size therefore
     * makes it exactly twice too big; that is what happened to the cloud layer,
     * where a 512px wisp covered a 480px screen.
     */
    fun drawW(id: Int) = pxW[id] * Sprite.ASSET_STORAGE_SCALE
    fun drawH(id: Int) = pxH[id] * Sprite.ASSET_STORAGE_SCALE

    fun glyphU0(i: Int) = gu0[i]
    fun glyphV0(i: Int) = gv0[i]
    fun glyphU1(i: Int) = gu1[i]
    fun glyphV1(i: Int) = gv1[i]

    /** Character -> glyph cell. Unknown characters fall back to a space. */
    fun cellOf(c: Char): Int {
        val code = c.code
        return if (code in 0..127) charIndex[code] else 0
    }

    fun load(context: Context) {
        val opts = BitmapFactory.Options().apply { inScaled = false }
        val parts = arrayOfNulls<Bitmap>(Sprite.COUNT)
        for (id in 0 until Sprite.COUNT) {
            val file = Sprite.FILES[id] ?: continue
            context.assets.open("sprites/$file.png").use { stream ->
                parts[id] = BitmapFactory.decodeStream(stream, null, opts)
            }
        }
        parts[Sprite.WHITE] = solidWhite()
        parts[Sprite.RING] = rotorArc()
        parts[Sprite.GLYPHS] = glyphSheet(parts[Sprite.PLAYER]!!)

        // Shelf pack, tallest first, so a 1024-wide atlas stays short.
        val order = (0 until Sprite.COUNT).sortedByDescending { parts[it]!!.height }
        val x = IntArray(Sprite.COUNT)
        val y = IntArray(Sprite.COUNT)
        var shelfX = 0
        var shelfY = 0
        var shelfH = 0
        for (id in order) {
            val b = parts[id]!!
            if (shelfX + b.width + PAD > ATLAS_W) {
                shelfY += shelfH + PAD
                shelfX = 0
                shelfH = 0
            }
            x[id] = shelfX
            y[id] = shelfY
            shelfX += b.width + PAD
            if (b.height > shelfH) shelfH = b.height
        }
        val atlasH = nextPowerOfTwo(shelfY + shelfH + PAD)

        val sheet = Bitmap.createBitmap(ATLAS_W, atlasH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(sheet)
        for (id in 0 until Sprite.COUNT) {
            val b = parts[id]!!
            canvas.drawBitmap(b, x[id].toFloat(), y[id].toFloat(), null)
            // Half-texel inset: GL_LINEAR would otherwise sample a neighbour's edge.
            u0[id] = (x[id] + 0.5f) / ATLAS_W
            v0[id] = (y[id] + 0.5f) / atlasH
            u1[id] = (x[id] + b.width - 0.5f) / ATLAS_W
            v1[id] = (y[id] + b.height - 0.5f) / atlasH
            pxW[id] = b.width.toFloat()
            pxH[id] = b.height.toFloat()
        }

        val gx = x[Sprite.GLYPHS]
        val gy = y[Sprite.GLYPHS]
        for (i in 0 until GLYPH_CELLS) {
            val cx = gx + (i % GLYPH_COLS) * GLYPH_CELL
            val cy = gy + (i / GLYPH_COLS) * GLYPH_CELL
            gu0[i] = (cx + 0.5f) / ATLAS_W
            gv0[i] = (cy + 0.5f) / atlasH
            gu1[i] = (cx + GLYPH_CELL - 0.5f) / ATLAS_W
            gv1[i] = (cy + GLYPH_CELL - 0.5f) / atlasH
        }
        for (i in charIndex.indices) charIndex[i] = 0
        for (i in CHARS.indices) {
            val code = CHARS[i].code
            if (code in 0..127) charIndex[code] = i
        }
        // Lower case maps onto the upper-case cell so callers need not shout.
        for (c in 'a'..'z') charIndex[c.code] = charIndex[(c - 32).code]

        texture = upload(sheet)
        sheet.recycle()
        for (b in parts) b?.recycle()

        cityA = loadTexture(context, "city_istanbul", opts)
        cityB = loadTexture(context, "city_istanbul_b", opts)
    }

    private fun loadTexture(context: Context, name: String, opts: BitmapFactory.Options): Int {
        context.assets.open("sprites/$name.png").use { stream ->
            val bmp = BitmapFactory.decodeStream(stream, null, opts)!!
            val id = upload(bmp)
            bmp.recycle()
            return id
        }
    }

    private fun nextPowerOfTwo(v: Int): Int {
        var n = 1
        while (n < v) n = n shl 1
        return n
    }

    private fun solidWhite(): Bitmap {
        val b = Bitmap.createBitmap(8, 8, Bitmap.Config.ARGB_8888)
        b.eraseColor(-0x1)
        return b
    }

    /** Procedural rotor arc -- a shape, the GL analogue of a Canvas stroked arc. */
    private fun rotorArc(): Bitmap {
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

    /**
     * The HUD font, baked once into a grid. Text is drawn as quads out of the same
     * atlas as everything else, so score and lives add no draw call of their own.
     */
    private fun glyphSheet(drone: Bitmap): Bitmap {
        val bmp = Bitmap.createBitmap(
            GLYPH_COLS * GLYPH_CELL, GLYPH_ROWS * GLYPH_CELL, Bitmap.Config.ARGB_8888
        )
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = -0x1
            textSize = GLYPH_CELL * 0.78f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
        val baseline = GLYPH_CELL * 0.5f - (p.descent() + p.ascent()) * 0.5f
        val buf = CharArray(1)
        for (i in CHARS.indices) {
            buf[0] = CHARS[i]
            val cx = (i % GLYPH_COLS) * GLYPH_CELL + GLYPH_CELL * 0.5f
            val cy = (i / GLYPH_COLS) * GLYPH_CELL + baseline
            c.drawText(buf, 0, 1, cx, cy, p)
        }
        val li = LIFE_ICON_INDEX
        val dst = android.graphics.Rect(
            (li % GLYPH_COLS) * GLYPH_CELL + 2, (li / GLYPH_COLS) * GLYPH_CELL + 2,
            (li % GLYPH_COLS) * GLYPH_CELL + GLYPH_CELL - 2,
            (li / GLYPH_COLS) * GLYPH_CELL + GLYPH_CELL - 2
        )
        c.drawBitmap(drone, null, dst, Paint(Paint.FILTER_BITMAP_FLAG))
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
}
