/**
 * Computes how far a value has traveled across a numeric range as a
 * percentage — the fill math behind a single-value range control's track,
 * built on the same clamp/round primitives a color channel or picking
 * surface already reaches for, so a percentage held to `[0, 100]` and
 * rounded to two decimal places stays a single shared computation instead of
 * a hand-rolled copy per control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { clampChannel, roundChannel } from "./color-math";

/**
 * Computes how far `value` has traveled from `min` toward `max` as a
 * percentage, clamped to `[0, 100]` and rounded to two decimal places;
 * returns `0` for a collapsed or inverted range instead of dividing by zero.
 *
 * @param min Lower bound of the range.
 * @param max Upper bound of the range.
 * @param value Current value the fill represents.
 * @returns The clamped, rounded fill percentage, e.g. `42.5`.
 * @example
 * resolveFillPercent(0, 100, 25); // 25
 * @example
 * resolveFillPercent(0, 10, 15); // 100 (clamped)
 * @example
 * resolveFillPercent(0, 0, 5); // 0 (collapsed range)
 */
export function resolveFillPercent(min: number, max: number, value: number): number {
	if (max <= min) return 0;
	let percent = ((value - min) / (max - min)) * 100;
	return roundChannel(clampChannel(percent, 0, 100), 2);
}
