package dev.dronewar.sim

/** The four movement keys the player sim reacts to. */
public enum class Key { LEFT, RIGHT, UP, DOWN }

/**
 * Held keys and the movement axis they produce -- the keyboard half of
 * `src/input/Input.js`.
 *
 * ```js
 * axis() {
 *   let ax = 0, ay = 0;
 *   if (this.keys.has('left'))  ax -= 1;
 *   if (this.keys.has('right')) ax += 1;
 *   if (this.keys.has('up'))    ay -= 1;
 *   if (this.keys.has('down'))  ay += 1;
 *   if (ax && ay) { const inv = 1 / Math.SQRT2; ax *= inv; ay *= inv; }
 *   return { ax, ay };
 * }
 * ```
 *
 * Held keys are a bitmask rather than a `Set`, and the axis lands in the [ax]/[ay]
 * fields rather than in a returned pair, so a sim step allocates nothing.
 *
 * Opposed keys cancel exactly as in the web build: left+right held at once gives
 * `ax == 0`, and the drone coasts into the decay branch.
 */
public class InputState {

    private var held: Int = 0

    /** Horizontal axis: -1, 0, +1, or +-1/sqrt(2) on a diagonal. */
    @JvmField
    public var ax: Double = 0.0

    /** Vertical axis, screen-down positive. */
    @JvmField
    public var ay: Double = 0.0

    public fun press(key: Key) {
        held = held or (1 shl key.ordinal)
    }

    public fun release(key: Key) {
        held = held and (1 shl key.ordinal).inv()
    }

    public fun isHeld(key: Key): Boolean = (held and (1 shl key.ordinal)) != 0

    public fun clear() {
        held = 0
        ax = 0.0
        ay = 0.0
    }

    /** Recomputes [ax]/[ay] from the held keys. Call once per sim step. */
    public fun refreshAxis() {
        var x = 0.0
        var y = 0.0
        if (isHeld(Key.LEFT)) x -= 1.0
        if (isHeld(Key.RIGHT)) x += 1.0
        if (isHeld(Key.UP)) y -= 1.0
        if (isHeld(Key.DOWN)) y += 1.0
        if (x != 0.0 && y != 0.0) {
            // `1 / Math.SQRT2`, spelled out: Math.SQRT2 is a JS language constant,
            // not a game constant, so it does not belong in :rules. The literal is
            // the float64 V8 reports for Math.SQRT2, and the reciprocal is taken the
            // same way round as the web source -- `1 / c`, not a second literal.
            val inv = 1.0 / 1.4142135623730951
            x *= inv
            y *= inv
        }
        ax = x
        ay = y
    }
}
