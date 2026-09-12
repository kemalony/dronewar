package dev.dronewar.bench.gl

import android.opengl.GLES20
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.ShortBuffer

/**
 * Indexed quad batcher for ES 2.0. Flushes when the texture or blend mode changes or
 * the buffer fills, so a frame of the reference scene costs a handful of draw calls
 * instead of one per sprite.
 */
class SpriteBatch(private val maxQuads: Int = 2048) {

    companion object {
        const val BLEND_NORMAL = 0
        const val BLEND_ADD = 1
        private const val FLOATS_PER_VERTEX = 8 // x, y, u, v, r, g, b, a
        private const val VERTS_PER_QUAD = 4

        private const val VERTEX_SRC = """
            uniform mat4 uProj;
            attribute vec2 aPos;
            attribute vec2 aUV;
            attribute vec4 aColor;
            varying vec2 vUV;
            varying vec4 vColor;
            void main() {
                vUV = aUV;
                vColor = aColor;
                gl_Position = uProj * vec4(aPos, 0.0, 1.0);
            }
        """

        private const val FRAGMENT_SRC = """
            precision mediump float;
            uniform sampler2D uTex;
            varying vec2 vUV;
            varying vec4 vColor;
            void main() {
                gl_FragColor = texture2D(uTex, vUV) * vColor;
            }
        """
    }

    private val verts = FloatArray(maxQuads * VERTS_PER_QUAD * FLOATS_PER_VERTEX)
    private val vertBuf: FloatBuffer = ByteBuffer
        .allocateDirect(verts.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
    private val indexBuf: ShortBuffer = ByteBuffer
        .allocateDirect(maxQuads * 6 * 2).order(ByteOrder.nativeOrder()).asShortBuffer()

    private var program = 0
    private var aPos = 0
    private var aUV = 0
    private var aColor = 0
    private var uProj = 0
    private var uTex = 0

    private val proj = FloatArray(16)
    private var quads = 0
    private var cursor = 0
    private var currentTexture = -1
    private var currentBlend = BLEND_NORMAL

    var drawCalls = 0; private set

    fun create(worldW: Float, worldH: Float) {
        program = link(VERTEX_SRC, FRAGMENT_SRC)
        aPos = GLES20.glGetAttribLocation(program, "aPos")
        aUV = GLES20.glGetAttribLocation(program, "aUV")
        aColor = GLES20.glGetAttribLocation(program, "aColor")
        uProj = GLES20.glGetUniformLocation(program, "uProj")
        uTex = GLES20.glGetUniformLocation(program, "uTex")

        // Orthographic, origin top-left, y growing downwards to match Canvas.
        java.util.Arrays.fill(proj, 0f)
        proj[0] = 2f / worldW
        proj[5] = -2f / worldH
        proj[10] = -1f
        proj[12] = -1f
        proj[13] = 1f
        proj[15] = 1f

        for (q in 0 until maxQuads) {
            val v = (q * VERTS_PER_QUAD).toShort()
            indexBuf.put((v + 0).toShort()).put((v + 1).toShort()).put((v + 2).toShort())
            indexBuf.put((v + 0).toShort()).put((v + 2).toShort()).put((v + 3).toShort())
        }
        indexBuf.position(0)

        GLES20.glDisable(GLES20.GL_DEPTH_TEST)
        GLES20.glEnable(GLES20.GL_BLEND)
    }

    fun begin() {
        drawCalls = 0
        quads = 0
        cursor = 0
        currentTexture = -1
        GLES20.glUseProgram(program)
        GLES20.glUniformMatrix4fv(uProj, 1, false, proj, 0)
        GLES20.glUniform1i(uTex, 0)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glEnableVertexAttribArray(aPos)
        GLES20.glEnableVertexAttribArray(aUV)
        GLES20.glEnableVertexAttribArray(aColor)
        applyBlend(BLEND_NORMAL)
    }

    private fun applyBlend(mode: Int) {
        currentBlend = mode
        if (mode == BLEND_ADD) GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE)
        else GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
    }

    /** Axis-aligned quad in world units, top-left anchored. */
    fun draw(
        texture: Int, x: Float, y: Float, w: Float, h: Float,
        r: Float = 1f, g: Float = 1f, b: Float = 1f, a: Float = 1f,
        blend: Int = BLEND_NORMAL
    ) {
        prepare(texture, blend)
        push(x, y, 0f, 0f, r, g, b, a)
        push(x + w, y, 1f, 0f, r, g, b, a)
        push(x + w, y + h, 1f, 1f, r, g, b, a)
        push(x, y + h, 0f, 1f, r, g, b, a)
        quads++
    }

    /** Centre-anchored quad with rotation, for banking drones. */
    fun drawRotated(
        texture: Int, cx: Float, cy: Float, w: Float, h: Float, radians: Float,
        r: Float = 1f, g: Float = 1f, b: Float = 1f, a: Float = 1f,
        blend: Int = BLEND_NORMAL
    ) {
        prepare(texture, blend)
        val hw = w * 0.5f
        val hh = h * 0.5f
        val cos = kotlin.math.cos(radians)
        val sin = kotlin.math.sin(radians)
        push(cx - hw * cos + hh * sin, cy - hw * sin - hh * cos, 0f, 0f, r, g, b, a)
        push(cx + hw * cos + hh * sin, cy + hw * sin - hh * cos, 1f, 0f, r, g, b, a)
        push(cx + hw * cos - hh * sin, cy + hw * sin + hh * cos, 1f, 1f, r, g, b, a)
        push(cx - hw * cos - hh * sin, cy - hw * sin + hh * cos, 0f, 1f, r, g, b, a)
        quads++
    }

    private fun prepare(texture: Int, blend: Int) {
        if (texture != currentTexture || blend != currentBlend || quads >= maxQuads) {
            flush()
            currentTexture = texture
            applyBlend(blend)
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture)
        }
    }

    private fun push(x: Float, y: Float, u: Float, v: Float, r: Float, g: Float, b: Float, a: Float) {
        val i = cursor
        verts[i] = x; verts[i + 1] = y
        verts[i + 2] = u; verts[i + 3] = v
        verts[i + 4] = r; verts[i + 5] = g; verts[i + 6] = b; verts[i + 7] = a
        cursor = i + FLOATS_PER_VERTEX
    }

    fun flush() {
        if (quads == 0) return
        vertBuf.position(0)
        vertBuf.put(verts, 0, cursor)
        vertBuf.position(0)

        val stride = FLOATS_PER_VERTEX * 4
        vertBuf.position(0)
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, stride, vertBuf)
        vertBuf.position(2)
        GLES20.glVertexAttribPointer(aUV, 2, GLES20.GL_FLOAT, false, stride, vertBuf)
        vertBuf.position(4)
        GLES20.glVertexAttribPointer(aColor, 4, GLES20.GL_FLOAT, false, stride, vertBuf)

        indexBuf.position(0)
        GLES20.glDrawElements(GLES20.GL_TRIANGLES, quads * 6, GLES20.GL_UNSIGNED_SHORT, indexBuf)
        drawCalls++

        quads = 0
        cursor = 0
    }

    fun end() {
        flush()
        GLES20.glDisableVertexAttribArray(aPos)
        GLES20.glDisableVertexAttribArray(aUV)
        GLES20.glDisableVertexAttribArray(aColor)
    }

    private fun link(vsSrc: String, fsSrc: String): Int {
        val vs = compile(GLES20.GL_VERTEX_SHADER, vsSrc)
        val fs = compile(GLES20.GL_FRAGMENT_SHADER, fsSrc)
        val p = GLES20.glCreateProgram()
        GLES20.glAttachShader(p, vs)
        GLES20.glAttachShader(p, fs)
        GLES20.glLinkProgram(p)
        val status = IntArray(1)
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, status, 0)
        check(status[0] != 0) { "program link failed: " + GLES20.glGetProgramInfoLog(p) }
        GLES20.glDeleteShader(vs)
        GLES20.glDeleteShader(fs)
        return p
    }

    private fun compile(type: Int, src: String): Int {
        val s = GLES20.glCreateShader(type)
        GLES20.glShaderSource(s, src)
        GLES20.glCompileShader(s)
        val status = IntArray(1)
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, status, 0)
        check(status[0] != 0) { "shader compile failed: " + GLES20.glGetShaderInfoLog(s) }
        return s
    }
}
