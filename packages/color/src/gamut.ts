/**
 * sRGB gamut checks and the CSS Color 4 gamut-mapping algorithm. Mapping lowers OKLCH
 * chroma until the color fits, keeping lightness and hue, so a wide-gamut color lands on
 * the nearest displayable shade of itself instead of a per-channel clip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Vector } from "./spaces.js";

import { oklabToOklch, oklabToSrgb, oklchToOklab, srgbToOklab } from "./spaces.js";

/**
 * How far past 0 or 1 a channel may sit and still count as in gamut, so float noise from a
 * conversion never flips a displayable color to out-of-gamut.
 */
const GAMUT_EPSILON = 1e-6;

/** The color difference CSS treats as just noticeable, in ΔEOK. */
const JUST_NOTICEABLE = 0.02;

/** The chroma precision at which the binary search stops. */
const CHROMA_PRECISION = 1e-4;

/** Whether every channel of gamma-encoded sRGB sits inside `[0, 1]`, within float noise. */
export function isInSrgbGamut(rgb: Vector): boolean {
	return rgb.every((channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);
}

/** Each channel clamped to `[0, 1]`. */
function clip(rgb: Vector): Vector {
	return [
		Math.min(Math.max(rgb[0], 0), 1),
		Math.min(Math.max(rgb[1], 0), 1),
		Math.min(Math.max(rgb[2], 0), 1),
	];
}

/** The Euclidean distance between two colors in Oklab, CSS's ΔEOK. */
function deltaEOK(first: Vector, second: Vector): number {
	return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

/**
 * Maps gamma-encoded sRGB into the sRGB gamut by the CSS Color 4 algorithm: a lightness at
 * or past 1 is white and at or below 0 is black; otherwise chroma is binary-searched down
 * until clipping the result moves it by less than a just-noticeable difference.
 *
 * @returns The input itself when it already fits, so callers can compare by identity.
 */
export function mapToSrgbGamut(rgb: Vector): Vector {
	if (isInSrgbGamut(rgb)) return rgb;

	let origin = oklabToOklch(srgbToOklab(rgb));
	if (origin[0] >= 1) return [1, 1, 1];
	if (origin[0] <= 0) return [0, 0, 0];

	let toSrgb = (chroma: number): Vector =>
		oklabToSrgb(oklchToOklab([origin[0], chroma, origin[2]]));
	let clipped = clip(rgb);
	if (deltaEOK(srgbToOklab(clipped), srgbToOklab(rgb)) < JUST_NOTICEABLE) return clipped;

	let min = 0;
	let max = origin[1];
	let minInGamut = true;
	while (max - min > CHROMA_PRECISION) {
		let chroma = (min + max) / 2;
		let current = toSrgb(chroma);
		if (minInGamut && isInSrgbGamut(current)) {
			min = chroma;
			continue;
		}
		clipped = clip(current);
		let error = deltaEOK(srgbToOklab(clipped), srgbToOklab(current));
		if (error >= JUST_NOTICEABLE) {
			max = chroma;
			continue;
		}
		if (JUST_NOTICEABLE - error < CHROMA_PRECISION) return clipped;
		minInGamut = false;
		min = chroma;
	}
	return clipped;
}
