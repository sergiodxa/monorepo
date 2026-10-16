/**
 * Parses the CSS colour notations a design token is written in — hex, `rgb()` and `oklch()` —
 * into straight-alpha sRGB, so an image can read the same values a stylesheet declares.
 * Out-of-gamut oklch is clipped per channel, matching what a browser paints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Raster } from "./types.js";

/** `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`. */
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** A CSS colour function: its name and everything between the parentheses. */
const FUNCTION = /^(rgba?|oklch)\(\s*([^)]*)\)$/i;

/** Fully transparent black, the colour a fade to nothing ends on. */
export const TRANSPARENT: Raster.Color = Object.freeze({ r: 0, g: 0, b: 0, a: 0 });

/**
 * Parses an authored colour. Malformed input is a mistake in the source, so it throws a
 * `RangeError` naming the value instead of drawing with a guess.
 *
 * @param input - Hex, `rgb()`/`rgba()` or `oklch()`, comma or space separated, with `/ alpha`
 * @returns The colour as straight-alpha sRGB in `0–1`
 * @example color("#0b0c10")
 * @example color("oklch(0.55 0.2 275 / 40%)")
 */
export function color(input: string): Raster.Color {
	let value = input.trim();
	let hex = HEX.exec(value);
	if (hex) return fromHex(hex[1] ?? "");
	let call = FUNCTION.exec(value);
	if (call) {
		let name = (call[1] ?? "").toLowerCase();
		let [channels, alpha] = splitArguments(call[2] ?? "");
		if (channels.length === 3) {
			let a = alpha === undefined ? 1 : clamp(number(alpha, 1, input));
			if (name === "oklch") return fromOklch(channels, a, input);
			return {
				r: clamp(number(channels[0] ?? "", 255, input) / 255),
				g: clamp(number(channels[1] ?? "", 255, input) / 255),
				b: clamp(number(channels[2] ?? "", 255, input) / 255),
				a,
			};
		}
	}
	throw new RangeError(`Unsupported colour: ${input}`);
}

/**
 * The same colour with its alpha multiplied by `opacity`, for a translucent variant of a
 * token without restating it.
 *
 * @example withAlpha(brand, 0.14)
 */
export function withAlpha(base: Raster.Color, opacity: number): Raster.Color {
	return { ...base, a: clamp(base.a * opacity) };
}

/** Expands the short forms by doubling each digit, as CSS does. */
function fromHex(digits: string): Raster.Color {
	let full =
		digits.length <= 4
			? digits
					.split("")
					.map((digit) => digit + digit)
					.join("")
			: digits;
	let byte = (index: number) => Number.parseInt(full.slice(index, index + 2), 16) / 255;
	return { r: byte(0), g: byte(2), b: byte(4), a: full.length === 8 ? byte(6) : 1 };
}

/**
 * Splits the channels from the optional alpha, accepting both the legacy comma form
 * (`255, 0, 0, 0.5`) and the modern space form (`255 0 0 / 50%`).
 */
function splitArguments(body: string): [string[], string | undefined] {
	if (body.includes(",")) {
		let parts = body.split(",").map((part) => part.trim());
		return [parts.slice(0, 3), parts[3]];
	}
	let [channels = "", alpha] = body.split("/").map((part) => part.trim());
	return [channels.split(/\s+/).filter(Boolean), alpha];
}

/**
 * Reads a number or a percentage, where `100%` stands for `percentScale` — 255 for an rgb
 * channel, 1 for alpha and oklch lightness.
 */
function number(token: string, percentScale: number, input: string): number {
	let percent = token.endsWith("%");
	let parsed = Number.parseFloat(percent ? token.slice(0, -1) : token.replace(/deg$/, ""));
	if (!Number.isFinite(parsed)) throw new RangeError(`Unsupported colour: ${input}`);
	return percent ? (parsed / 100) * percentScale : parsed;
}

/**
 * Converts OKLCh to sRGB through OKLab and linear sRGB with Björn Ottosson's matrices, then
 * applies the sRGB transfer curve. Lightness may be `0–1` or a percentage.
 */
function fromOklch(channels: string[], a: number, input: string): Raster.Color {
	let lightness = number(channels[0] ?? "", 1, input);
	let chroma = number(channels[1] ?? "", 0.4, input);
	let hue = (number(channels[2] ?? "", 360, input) * Math.PI) / 180;
	let labA = chroma * Math.cos(hue);
	let labB = chroma * Math.sin(hue);
	let l = (lightness + 0.3963377774 * labA + 0.2158037573 * labB) ** 3;
	let m = (lightness - 0.1055613458 * labA - 0.0638541728 * labB) ** 3;
	let s = (lightness - 0.0894841775 * labA - 1.291485548 * labB) ** 3;
	return {
		r: clamp(encodeSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
		g: clamp(encodeSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
		b: clamp(encodeSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
		a,
	};
}

/** The sRGB transfer function, from linear light to the encoded value a pixel stores. */
function encodeSrgb(linear: number): number {
	if (linear <= 0.0031308) return 12.92 * linear;
	return 1.055 * linear ** (1 / 2.4) - 0.055;
}

/** Clips to `0–1`, which is how out-of-gamut channels end up on screen. */
function clamp(value: number): number {
	return Math.min(1, Math.max(0, value));
}
