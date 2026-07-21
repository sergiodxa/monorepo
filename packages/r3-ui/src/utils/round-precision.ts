/**
 * Rounds a number to a fixed decimal precision, discarding floating-point
 * noise — shared by every module under `utils/` that cleans up a computed
 * value before formatting, comparing, or plotting it: a color channel
 * rounded to a whole number or a couple of decimal places, or an SVG
 * coordinate rounded far finer than a screen pixel so a "clean" angle's
 * `Math.sin`/`Math.cos` doesn't trail off into `1e-16`-scale artifacts.
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
