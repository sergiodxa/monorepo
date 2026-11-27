/**
 * The immutable `Color` value. It stores extended sRGB as unclamped floats plus alpha, so a
 * wide-gamut color from `oklch()` or `color(display-p3)` survives losslessly, and converts to
 * Oklab or OKLCH on demand for every perceptual operation, contrast check and scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { ColorParseError } from "./color-parse-error.js";
import type { ContrastAlgorithm, WcagContrast } from "./contrast.js";
import type { InterpolationOptions } from "./interpolate.js";
import type { Vector } from "./spaces.js";

import { ContrastUnreachableError } from "./contrast-unreachable-error.js";
import { relativeLuminance, wcagContrast } from "./contrast.js";
import { isInSrgbGamut, mapToSrgbGamut } from "./gamut.js";
import { interpolate } from "./interpolate.js";
import { parseColor } from "./parse.js";
import {
	hslToSrgb,
	hwbToSrgb,
	normalizeHue,
	oklabToOklch,
	oklabToSrgb,
	oklchToOklab,
	srgbToHsl,
	srgbToOklab,
} from "./spaces.js";

/** sRGB channels, nominally 0–1 but unclamped for wide-gamut colors, and alpha 0–1. */
export interface Rgb {
	r: number;
	g: number;
	b: number;
	alpha: number;
}

/** HSL with hue in degrees `[0, 360)` and saturation, lightness and alpha 0–1. */
export interface Hsl {
	h: number;
	s: number;
	l: number;
	alpha: number;
}

/** Oklab with lightness 0–1 and a, b roughly ±0.4. */
export interface Oklab {
	l: number;
	a: number;
	b: number;
	alpha: number;
}

/** OKLCH with lightness 0–1, chroma from 0 (about 0.37 at sRGB's edge) and hue in degrees. */
export interface Oklch {
	l: number;
	c: number;
	h: number;
	alpha: number;
}

/** The exact OKLCH values `Color#with` sets; anything omitted keeps the color's own. */
export interface OklchChanges {
	lightness?: number;
	chroma?: number;
	hue?: number;
	alpha?: number;
}

/**
 * The CSS `Color#toString` prints. `"hex"`, `"rgb"` and `"hsl"` describe sRGB only, so they
 * gamut-map first; `"srgb"` (`color(srgb …)`), `"oklch"` and `"oklab"` are lossless.
 */
export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch" | "oklab" | "srgb";

/** The default tolerance of `Color#equals`, wide enough to absorb float noise from conversion. */
const EQUALS_EPSILON = 1e-6;

/** Bisection rounds `ensureContrast` runs on lightness, far below any visible step. */
const LIGHTNESS_ITERATIONS = 40;

/**
 * An immutable CSS color. Build one with `Color.parse` or a numeric constructor; every
 * operation answers a new `Color`. An authored hue on a gray and `none` components are not
 * kept: a gray reads back with hue 0, and `none` reads as 0.
 */
export class Color {
	readonly #r: number;
	readonly #g: number;
	readonly #b: number;
	readonly #alpha: number;

	/** Stores the channels, reading a non-finite one as 0 and clamping alpha to 0–1. */
	private constructor(r: number, g: number, b: number, alpha: number) {
		this.#r = finite(r);
		this.#g = finite(g);
		this.#b = finite(b);
		this.#alpha = clamp(finite(alpha), 0, 1);
		Object.freeze(this);
	}

	/**
	 * Reads any CSS color: hex, named colors and `transparent`, `rgb()`, `hsl()`, `hwb()`,
	 * `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` in its predefined spaces, both
	 * as authored and as `getComputedStyle` serializes them.
	 *
	 * @example
	 * Color.parse("oklch(0.24 0.008 70)"); // Success<Color>
	 * @example
	 * Color.parse("currentcolor"); // Failure<ColorParseError>
	 */
	static parse(input: string): Result<Color, ColorParseError> {
		let parsed = parseColor(input);
		if (isFailure(parsed)) return parsed;
		let { r, g, b, alpha } = parsed.data;
		return success(new Color(r, g, b, alpha));
	}

	/** A color from sRGB channels 0–1, kept unclamped so values outside describe wide gamut. */
	static rgb(r: number, g: number, b: number, alpha = 1): Color {
		return new Color(r, g, b, alpha);
	}

	/** A color from HSL: hue in degrees, saturation and lightness 0–1. */
	static hsl(hue: number, saturation: number, lightness: number, alpha = 1): Color {
		let [r, g, b] = hslToSrgb(finite(hue), finite(saturation), finite(lightness));
		return new Color(r, g, b, alpha);
	}

	/** A color from HWB: hue in degrees, whiteness and blackness 0–1. */
	static hwb(hue: number, whiteness: number, blackness: number, alpha = 1): Color {
		let [r, g, b] = hwbToSrgb(finite(hue), finite(whiteness), finite(blackness));
		return new Color(r, g, b, alpha);
	}

	/** A color from Oklab: lightness 0–1 and a, b roughly ±0.4. */
	static oklab(lightness: number, a: number, b: number, alpha = 1): Color {
		return Color.#fromVector(oklabToSrgb([finite(lightness), finite(a), finite(b)]), alpha);
	}

	/** A color from OKLCH: lightness 0–1, chroma from 0 and hue in degrees. */
	static oklch(lightness: number, chroma: number, hue: number, alpha = 1): Color {
		let lab = oklchToOklab([finite(lightness), finite(chroma), finite(hue)]);
		return Color.#fromVector(oklabToSrgb(lab), alpha);
	}

	/** The contrast of `foreground` painted on `background`; see `Color#contrast`. */
	static contrast(
		foreground: Color,
		background: Color,
		algorithm: ContrastAlgorithm = "WCAG21",
	): WcagContrast {
		return foreground.contrast(background, algorithm);
	}

	/**
	 * A gradient through `colors`, evenly spaced, as a function from `t` in 0–1 to a color.
	 * `t` is clamped, and each segment interpolates as `mix` does.
	 *
	 * @example
	 * let heat = Color.scale([blue, yellow, red]); heat(0.5); // yellow
	 */
	static scale(
		colors: readonly [Color, ...Color[]],
		options: InterpolationOptions = {},
	): (t: number) => Color {
		let [first] = colors;
		let segments = colors.length - 1;
		if (segments === 0) return () => first;
		return (t) => {
			let position = clamp(finite(t), 0, 1) * segments;
			let index = Math.min(Math.floor(position), segments - 1);
			let from = colors[index] ?? first;
			let to = colors[index + 1] ?? first;
			return from.mix(to, position - index, options);
		};
	}

	/**
	 * `count` evenly spaced colors along `Color.scale(colors, options)`, both ends included.
	 * One step answers the first color, and fewer than one answers none.
	 */
	static steps(
		colors: readonly [Color, ...Color[]],
		count: number,
		options: InterpolationOptions = {},
	): Color[] {
		let scale = Color.scale(colors, options);
		if (count < 1) return [];
		if (count < 2) return [scale(0)];
		return Array.from({ length: Math.floor(count) }, (_, index) => scale(index / (count - 1)));
	}

	/** A color from gamma-encoded sRGB channels. */
	static #fromVector(rgb: Vector, alpha: number): Color {
		return new Color(rgb[0], rgb[1], rgb[2], alpha);
	}

	/** Opacity from 0 (transparent) to 1 (opaque). */
	get alpha(): number {
		return this.#alpha;
	}

	/** The stored channels, unclamped, so a wide-gamut color reads below 0 or above 1. */
	toRgb(): Rgb {
		return { r: this.#r, g: this.#g, b: this.#b, alpha: this.#alpha };
	}

	/** The color as HSL, gamut-mapped first because HSL cannot describe anything outside sRGB. */
	toHsl(): Hsl {
		let [h, s, l] = srgbToHsl(mapToSrgbGamut(this.#vector()));
		return { h, s, l, alpha: this.#alpha };
	}

	/** The color in Oklab, unclamped. */
	toOklab(): Oklab {
		let [l, a, b] = srgbToOklab(this.#vector());
		return { l, a, b, alpha: this.#alpha };
	}

	/** The color in OKLCH, unclamped; an achromatic color answers a hue of 0. */
	toOklch(): Oklch {
		let [l, c, h] = oklabToOklch(srgbToOklab(this.#vector()));
		return { l, c, h, alpha: this.#alpha };
	}

	/** Whether every sRGB channel and alpha differs from `other`'s by at most `epsilon`. */
	equals(other: Color, epsilon = EQUALS_EPSILON): boolean {
		let mine = this.toRgb();
		let theirs = other.toRgb();
		return (
			Math.abs(mine.r - theirs.r) <= epsilon &&
			Math.abs(mine.g - theirs.g) <= epsilon &&
			Math.abs(mine.b - theirs.b) <= epsilon &&
			Math.abs(mine.alpha - theirs.alpha) <= epsilon
		);
	}

	/** Whether the color fits in sRGB, so every display can show it as is. */
	inGamut(): boolean {
		return isInSrgbGamut(this.#vector());
	}

	/**
	 * The color mapped into sRGB by the CSS Color 4 algorithm, which lowers OKLCH chroma and
	 * keeps lightness and hue. A color already inside answers itself.
	 */
	toGamut(): Color {
		let vector = this.#vector();
		let mapped = mapToSrgbGamut(vector);
		return mapped === vector ? this : Color.#fromVector(mapped, this.#alpha);
	}

	/**
	 * Valid CSS for the color, so `${color}` works anywhere CSS does. Without a format it is
	 * `rgb(r g b / a)` inside sRGB and `oklch()` outside, which no display clips.
	 */
	toString(format?: ColorFormat): string {
		let chosen = format ?? (this.inGamut() ? "rgb" : "oklch");
		let alpha = this.#alpha < 1 ? ` / ${formatNumber(this.#alpha, 4)}` : "";
		switch (chosen) {
			case "hex":
				return this.#hex();
			case "rgb": {
				let [r, g, b] = mapToSrgbGamut(this.#vector()).map((channel) =>
					formatNumber(clamp(channel, 0, 1) * 255, 2),
				);
				return `rgb(${r} ${g} ${b}${alpha})`;
			}
			case "hsl": {
				let { h, s, l } = this.toHsl();
				return `hsl(${formatNumber(h, 2)} ${formatNumber(s * 100, 2)}% ${formatNumber(l * 100, 2)}%${alpha})`;
			}
			case "oklch": {
				let { l, c, h } = this.toOklch();
				return `oklch(${formatNumber(l, 6)} ${formatNumber(c, 6)} ${formatNumber(h, 4)}${alpha})`;
			}
			case "oklab": {
				let { l, a, b } = this.toOklab();
				return `oklab(${formatNumber(l, 6)} ${formatNumber(a, 6)} ${formatNumber(b, 6)}${alpha})`;
			}
			case "srgb":
				return `color(srgb ${formatNumber(this.#r, 6)} ${formatNumber(this.#g, 6)} ${formatNumber(this.#b, 6)}${alpha})`;
		}
	}

	/**
	 * This color painted over `background` with source-over compositing in gamma-encoded
	 * sRGB, the way browsers paint a translucent layer.
	 */
	over(background: Color): Color {
		let alpha = this.#alpha + background.#alpha * (1 - this.#alpha);
		if (alpha === 0) return new Color(0, 0, 0, 0);
		let channel = (source: number, backdrop: number): number =>
			(source * this.#alpha + backdrop * background.#alpha * (1 - this.#alpha)) / alpha;
		return new Color(
			channel(this.#r, background.#r),
			channel(this.#g, background.#g),
			channel(this.#b, background.#b),
			alpha,
		);
	}

	/**
	 * This color mixed with `other` by CSS color-mix() rules, premultiplied alpha included.
	 * `amount` is the share of `other`: 0 answers this color and 1 answers `other`.
	 *
	 * @example
	 * red.mix(blue, 0.25, { space: "oklch", hue: "longer" });
	 */
	mix(other: Color, amount = 0.5, options: InterpolationOptions = {}): Color {
		let { r, g, b, alpha } = interpolate(this.toRgb(), other.toRgb(), finite(amount), options);
		return new Color(r, g, b, alpha);
	}

	/** The same color at opacity `alpha`, clamped to 0–1. */
	withAlpha(alpha: number): Color {
		return new Color(this.#r, this.#g, this.#b, alpha);
	}

	/** The same color with its alpha multiplied by `factor`. */
	fade(factor: number): Color {
		return this.withAlpha(this.#alpha * factor);
	}

	/** OKLCH lightness multiplied by `1 + amount`, clamped to 1: `lighten(0.1)` is 10% lighter. */
	lighten(amount: number): Color {
		return this.with({ lightness: clamp(this.toOklch().l * (1 + amount), 0, 1) });
	}

	/** OKLCH lightness multiplied by `1 - amount`, clamped to 0: `darken(0.1)` is 10% darker. */
	darken(amount: number): Color {
		return this.with({ lightness: clamp(this.toOklch().l * (1 - amount), 0, 1) });
	}

	/** OKLCH chroma multiplied by `1 + amount`; the result may leave sRGB, see `toGamut`. */
	saturate(amount: number): Color {
		return this.with({ chroma: Math.max(this.toOklch().c * (1 + amount), 0) });
	}

	/** OKLCH chroma multiplied by `1 - amount`, never below 0. */
	desaturate(amount: number): Color {
		return this.with({ chroma: Math.max(this.toOklch().c * (1 - amount), 0) });
	}

	/** The OKLCH hue turned by `degrees`, either way round. */
	rotate(degrees: number): Color {
		return this.with({ hue: normalizeHue(this.toOklch().h + finite(degrees)) });
	}

	/** The gray with the same OKLCH lightness. */
	grayscale(): Color {
		return this.with({ chroma: 0 });
	}

	/** The color opposite on the OKLCH hue circle, at the same lightness and chroma. */
	complement(): Color {
		return this.rotate(180);
	}

	/** Each sRGB channel inverted (`1 - channel`), alpha kept. */
	invert(): Color {
		return new Color(1 - this.#r, 1 - this.#g, 1 - this.#b, this.#alpha);
	}

	/**
	 * The color with exact OKLCH values set. A gray starts from hue 0, so giving it chroma
	 * without a hue turns it pink.
	 */
	with(changes: OklchChanges): Color {
		let current = this.toOklch();
		return Color.oklch(
			changes.lightness ?? current.l,
			changes.chroma ?? current.c,
			changes.hue ?? current.h,
			changes.alpha ?? current.alpha,
		);
	}

	/**
	 * The contrast of this color as text or a UI part on `background`. A translucent
	 * background is painted over white first and this color is painted over that, so the
	 * ratio is what a reader sees; both are gamut-mapped to sRGB before measuring.
	 * Order matters only for translucent colors; two opaque colors measure the same either way.
	 *
	 * @example
	 * Color.rgb(0, 0, 0).contrast(Color.rgb(1, 1, 1)).aa.text; // true, 21:1
	 */
	contrast(background: Color, _algorithm: ContrastAlgorithm = "WCAG21"): WcagContrast {
		let backdrop = background.#alpha < 1 ? background.over(opaqueWhite()) : background;
		let painted = this.#alpha < 1 ? this.over(backdrop) : this;
		return wcagContrast(
			relativeLuminance(mapToSrgbGamut(painted.#vector())),
			relativeLuminance(mapToSrgbGamut(backdrop.#vector())),
		);
	}

	/**
	 * The color closest to this one that reaches `ratio` against `background`, changing only
	 * OKLCH lightness, in whichever direction gets there with the smaller change. The answer
	 * is gamut-mapped, since that is the color contrast was measured on.
	 *
	 * @returns This color when it already passes, or a `ContrastUnreachableError` holding the
	 * best lightness extreme when neither black-ward nor white-ward reaches `ratio`.
	 */
	ensureContrast(background: Color, ratio: number): Result<Color, ContrastUnreachableError> {
		if (this.contrast(background).ratio >= ratio) return success(this);

		let lightness = this.toOklch().l;
		let candidate = (value: number): Color => this.with({ lightness: value }).toGamut();
		let measure = (value: number): number => candidate(value).contrast(background).ratio;

		let reachable: number[] = [];
		for (let end of [0, 1]) {
			if (measure(end) < ratio) continue;
			let failing = lightness;
			let passing = end;
			for (let round = 0; round < LIGHTNESS_ITERATIONS; round++) {
				let middle = (failing + passing) / 2;
				if (measure(middle) >= ratio) passing = middle;
				else failing = middle;
			}
			reachable.push(passing);
		}

		let closest: number | null = null;
		for (let value of reachable) {
			if (closest === null || Math.abs(value - lightness) < Math.abs(closest - lightness)) {
				closest = value;
			}
		}
		if (closest !== null) return success(candidate(closest));

		let best = measure(0) >= measure(1) ? 0 : 1;
		return failure(new ContrastUnreachableError(ratio, measure(best), candidate(best)));
	}

	/** Black or white, whichever contrasts more as text on this color; black wins a tie. */
	contrastingText(): Color {
		let black = new Color(0, 0, 0, 1);
		let white = opaqueWhite();
		return black.contrast(this).ratio >= white.contrast(this).ratio ? black : white;
	}

	/** The stored channels as a vector for the space math. */
	#vector(): Vector {
		return [this.#r, this.#g, this.#b];
	}

	/** `#rrggbb`, or `#rrggbbaa` below full opacity, from the gamut-mapped color. */
	#hex(): string {
		let [r, g, b] = mapToSrgbGamut(this.#vector());
		let bytes = [r, g, b, ...(this.#alpha < 1 ? [this.#alpha] : [])];
		return `#${bytes.map((channel) => toByte(channel).toString(16).padStart(2, "0")).join("")}`;
	}
}

/** Opaque white, the backdrop a translucent background is painted over before measuring. */
function opaqueWhite(): Color {
	return Color.rgb(1, 1, 1);
}

/** `value`, or 0 for `NaN` and the infinities, the way CSS reads `none`. */
function finite(value: number): number {
	return Number.isFinite(value) ? value : 0;
}

/** `value` limited to `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** A 0–1 channel as a rounded byte for hex output. */
function toByte(channel: number): number {
	return Math.round(clamp(channel, 0, 1) * 255);
}

/** `value` rounded to at most `digits` decimals, trailing zeros and negative zero dropped. */
function formatNumber(value: number, digits: number): string {
	let rounded = Number(value.toFixed(digits));
	return String(Object.is(rounded, -0) ? 0 : rounded);
}
