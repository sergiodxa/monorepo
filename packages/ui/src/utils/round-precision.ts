/**
 * Rounds a number to a fixed decimal precision, discarding floating-point
 * noise — shared by every module under `utils/` that cleans up a computed
 * value before formatting, comparing, or plotting it: a color channel
 * rounded to a whole number, or an SVG coordinate cleared of the
 * `1e-16`-scale drift `Math.sin`/`Math.cos` leaves in a "clean" angle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Rounds `value` to `precision` decimal places.
 *
 * @param value Value to round.
 * @param precision Decimal places to keep. Defaults to `0`.
 * @returns `value` rounded to `precision` decimal places.
 * @example
 * roundChannel(127.6); // 128
 * @example
 * roundChannel(0.4567, 2); // 0.46
 */
export function roundChannel(value: number, precision = 0): number {
	let factor = 10 ** precision;

	return Math.round(value * factor) / factor;
}
