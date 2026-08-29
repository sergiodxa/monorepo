/**
 * The radian measure of a full turn around a circle — the shared constant
 * behind computations that recognize or default to a complete revolution:
 * pie wedge sweep detection, a pie chart's default total span, and folding
 * an angle or hue back into its wraparound range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Radians in a full turn around a circle (`Math.PI * 2`).
 *
 * @example
 * let endAngle = startAngle + FULL_TURN_RADIANS; // one complete revolution
 */
export const FULL_TURN_RADIANS = Math.PI * 2;
