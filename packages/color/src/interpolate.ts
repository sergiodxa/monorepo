/**
 * Interpolation between two colors by the CSS color-mix() and gradient rules: premultiplied
 * alpha, a powerless hue taking the other color's hue, and the four hue arcs. `Color#mix`,
 * `Color.scale` and `Color.steps` all go through it, so they agree at every point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Rgb } from "./color.js";
import type { Vector } from "./spaces.js";

import {
	ACHROMATIC_CHROMA,
	normalizeHue,
	oklabToOklch,
	oklabToSrgb,
	oklchToOklab,
	srgbToOklab,
} from "./spaces.js";

/** The spaces colors interpolate in; `"oklab"` is CSS's default. */
export type InterpolationSpace = "oklab" | "oklch" | "srgb";

/** Which way round the hue circle an OKLCH interpolation travels; `"shorter"` is the default. */
export type HueInterpolation = "shorter" | "longer" | "increasing" | "decreasing";

/** How `mix`, `scale` and `steps` interpolate. */
export interface InterpolationOptions {
	/** @default "oklab" */
	space?: InterpolationSpace;
	/**
	 * The hue arc, read only when `space` is `"oklch"`.
	 *
	 * @default "shorter"
	 */
	hue?: HueInterpolation;
}

/**
 * The color `t` of the way from `from` to `to`, interpolated with premultiplied alpha so a
 * transparent end contributes no color of its own.
 */
export function interpolate(
	from: Rgb,
	to: Rgb,
	t: number,
	{ space = "oklab", hue = "shorter" }: InterpolationOptions,
): Rgb {
	let alpha = lerp(from.alpha, to.alpha, t);
	let start: Vector = [from.r, from.g, from.b];
	let end: Vector = [to.r, to.g, to.b];

	if (space === "srgb")
		return withAlpha(lerpPremultiplied(start, from.alpha, end, to.alpha, t, alpha, 3), alpha);
	if (space === "oklab") {
		let lab = lerpPremultiplied(
			srgbToOklab(start),
			from.alpha,
			srgbToOklab(end),
			to.alpha,
			t,
			alpha,
			3,
		);
		return withAlpha(oklabToSrgb(lab), alpha);
	}

	let startLch = oklabToOklch(srgbToOklab(start));
	let endLch = oklabToOklch(srgbToOklab(end));
	let lc = lerpPremultiplied(startLch, from.alpha, endLch, to.alpha, t, alpha, 2);
	let h = interpolateHue(hueOf(startLch, endLch), hueOf(endLch, startLch), t, hue);
	return withAlpha(oklabToSrgb(oklchToOklab([lc[0], lc[1], h])), alpha);
}

/** `start + (end - start) × t`, exact at both ends. */
function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

/**
 * Interpolates the first `count` components premultiplied by alpha and divides the result
 * by the interpolated alpha. When that alpha is 0 the components interpolate as they are,
 * since a fully transparent color has no premultiplied value to recover.
 */
function lerpPremultiplied(
	start: Vector,
	startAlpha: number,
	end: Vector,
	endAlpha: number,
	t: number,
	alpha: number,
	count: number,
): Vector {
	let result: Vector = [start[0], start[1], start[2]];
	for (let index = 0; index < count; index++) {
		result[index] =
			alpha === 0
				? lerp(start[index] ?? 0, end[index] ?? 0, t)
				: lerp((start[index] ?? 0) * startAlpha, (end[index] ?? 0) * endAlpha, t) / alpha;
	}
	return result;
}

/** Rebuilds an `Rgb` from interpolated channels. */
function withAlpha(rgb: Vector, alpha: number): Rgb {
	return { r: rgb[0], g: rgb[1], b: rgb[2], alpha };
}

/**
 * The hue to interpolate from for `lch`. An achromatic color's hue is powerless, so it
 * takes the other color's hue, and two grays share a hue of 0.
 */
function hueOf(lch: Vector, other: Vector): number {
	if (lch[1] >= ACHROMATIC_CHROMA) return lch[2];
	return other[1] >= ACHROMATIC_CHROMA ? other[2] : 0;
}

/** Interpolates two hues along the arc `method` picks, as CSS Color 4 defines each one. */
function interpolateHue(start: number, end: number, t: number, method: HueInterpolation): number {
	let from = start;
	let to = end;
	let delta = to - from;
	if (method === "shorter") {
		if (delta > 180) from += 360;
		else if (delta < -180) to += 360;
	} else if (method === "longer") {
		if (delta > 0 && delta < 180) from += 360;
		else if (delta > -180 && delta <= 0) to += 360;
	} else if (method === "increasing") {
		if (delta < 0) to += 360;
	} else if (delta > 0) {
		from += 360;
	}
	return normalizeHue(lerp(from, to, t));
}
