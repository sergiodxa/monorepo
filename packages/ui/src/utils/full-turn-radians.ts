/**
 * The radian measure of a full turn around a circle — the shared constant
 * behind every polar or point-math computation that needs to recognize or
 * default to a complete revolution: detecting a pie wedge's sweep as a full
 * circle, defaulting a pie chart's total span to one full turn starting from
 * its start angle, and folding an angle or hue back into its wraparound
 * range.
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
