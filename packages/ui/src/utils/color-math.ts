/**
 * Pure numeric and string math behind the color-editing components: parsing
 * a hex, `rgb()`, or `hsl()` color string into its channel values, formatting
 * those values back out in any of the three notations, converting a color
 * between the red/green/blue, hue/saturation/lightness, and hue/saturation/
 * value spaces, and the pointer-geometry math a two-dimensional picking
 * square or a circular hue ring turns a pointer position into. Every export
 * is a plain function operating on numbers and strings, with no knowledge of
 * the DOM or rendering — directly unit-testable and reusable ahead of any
 * markup or drag handling built on top.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Point } from "./geometry";

import { FULL_TURN_RADIANS } from "./full-turn-radians";
import { roundChannel } from "./round-precision";

export { roundChannel };

/**
 * A color's red, green, and blue channels, each `0`–`255`.
 */
export interface RGBColor {
	/** Red channel, `0`–`255`. */
	r: number;
	/** Green channel, `0`–`255`. */
	g: number;
	/** Blue channel, `0`–`255`. */
	b: number;
}

/**
 * An {@link RGBColor} plus an alpha channel — the shape {@link parseColor}
 * returns and every formatter (`formatHex`, `formatRgb`, `formatHsl`)
 * accepts.
 */
export interface RGBAColor extends RGBColor {
	/** Opacity, `0` (fully transparent) through `1` (fully opaque). */
	a: number;
}

/**
 * A color's hue, saturation, and lightness — the space a lightness-driven
 * pick (a shade ramp running from black through the pure hue to white)
 * reasons about most naturally.
 */
export interface HSLColor {
	/** Hue, in degrees around the color wheel, `0`–`360`. */
	h: number;
	/** Saturation, as a percentage, `0`–`100`. */
	s: number;
	/** Lightness, as a percentage, `0`–`100`. */
	l: number;
}

/**
 * A color's hue, saturation, and value (brightness) — the space behind a
 * two-dimensional saturation/value picking surface, where every reachable
 * color maps directly onto a square: saturation runs along one axis, value
 * along the other.
 */
export interface HSVColor {
	/** Hue, in degrees around the color wheel, `0`–`360`. */
	h: number;
	/** Saturation, as a percentage, `0`–`100`. */
	s: number;
	/** Value (brightness), as a percentage, `0`–`100`. */
	v: number;
}

/** Degrees in a full turn around the color wheel, shared by hue normalization and {@link angleToHue}/{@link hueToAngle}'s conversion. */
const FULL_TURN_DEGREES = 360;

/**
 * Clamps `value` into an inclusive numeric bound, generalized from a single
 * fixed range (a fill bar's percentage, always held to `0`–`100`) to any
 * bound a color value needs: an RGB channel's `0`–`255`, an alpha channel's
 * `0`–`1`, or a saturation/lightness/value percentage's `0`–`100`.
 *
 * @param value Value to clamp.
 * @param min Lower bound. Defaults to `0`.
 * @param max Upper bound. Defaults to `255`.
 * @returns `value` held within `[min, max]`.
 * @example
 * clampChannel(300); // 255
 * @example
 * clampChannel(-0.2, 0, 1); // 0
 */
export function clampChannel(value: number, min = 0, max = 255): number {
	return Math.min(max, Math.max(min, value));
}

/** Normalizes `hue` into the `[0, 360)` range a color wheel wraps around, folding a negative or over-large input back into range instead of clamping it. */
function normalizeHue(hue: number): number {
	return ((hue % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
}

/** Normalizes `angle` (radians) into the `[0, 2π)` range {@link angleFromCenter} produces, folding a negative or over-large input back into range instead of clamping it. */
function normalizeAngle(angle: number): number {
	return ((angle % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;
}

/**
 * Computes the hue angle, in degrees `0`–`360`, of a normalized (`0`–`1`)
 * RGB triplet already reduced to its `max` channel and `delta` (`max -
 * min`) — the first step shared by converting to either the hue/saturation/
 * lightness or the hue/saturation/value space, since both share the same
 * hue math and differ only in how they fold `max`/`min` into saturation and
 * a third channel.
 *
 * @param r Red channel, `0`–`1`.
 * @param g Green channel, `0`–`1`.
 * @param b Blue channel, `0`–`1`.
 * @param max The largest of `r`, `g`, `b`.
 * @param delta `max` minus the smallest of `r`, `g`, `b`.
 * @returns The hue angle, in degrees, `0`–`360`. Resolves to `0` for a fully desaturated color, where hue has no defined value but a real number is still needed.
 */
function computeHue(r: number, g: number, b: number, max: number, delta: number): number {
	if (delta === 0) return 0;

	let h: number;
	if (max === r) h = (g - b) / delta;
	else if (max === g) h = (b - r) / delta + 2;
	else h = (r - g) / delta + 4;

	h *= 60;
	return h < 0 ? h + 360 : h;
}

/**
 * Maps a hue's `0`–`360` sector to the `[first, second, third]` RGB-order
 * triplet built from `chroma` (the color's saturation-scaled span) and `x`
 * (the second-largest channel's share of that span) — the sector
 * assignment shared by converting either lightness- or value-anchored
 * chroma back to concrete red/green/blue channels, before either
 * conversion's own offset (lightness's `m`, value's `v - chroma`) shifts
 * every channel up to its final level.
 *
 * @param h Hue, in degrees, already normalized to `0`–`360`.
 * @param chroma The color's chroma for this hue/saturation pairing.
 * @param x The second-largest channel's share of `chroma` at this hue.
 * @returns The `[r, g, b]` triplet, each still needing the conversion's own offset added.
 */
function hueSectorRgb(h: number, chroma: number, x: number): [number, number, number] {
	if (h < 60) return [chroma, x, 0];
	if (h < 120) return [x, chroma, 0];
	if (h < 180) return [0, chroma, x];
	if (h < 240) return [0, x, chroma];
	if (h < 300) return [x, 0, chroma];
	return [chroma, 0, x];
}

/**
 * Converts an {@link RGBColor} to its {@link HSLColor} representation.
 *
 * @param color The color to convert.
 * @returns The equivalent hue/saturation/lightness values.
 * @example
 * rgbToHsl({ r: 255, g: 0, b: 0 }); // { h: 0, s: 100, l: 50 }
 * @example
 * rgbToHsl({ r: 128, g: 128, b: 128 }); // { h: 0, s: 0, l: ~50.2 }
 */
export function rgbToHsl(color: RGBColor): HSLColor {
	let r = clampChannel(color.r, 0, 255) / 255;
	let g = clampChannel(color.g, 0, 255) / 255;
	let b = clampChannel(color.b, 0, 255) / 255;

	let max = Math.max(r, g, b);
	let min = Math.min(r, g, b);
	let delta = max - min;
	let l = (max + min) / 2;

	let s: number;
	if (delta === 0) s = 0;
	else if (l > 0.5) s = delta / (2 - max - min);
	else s = delta / (max + min);

	return { h: computeHue(r, g, b, max, delta), s: s * 100, l: l * 100 };
}

/**
 * Converts an {@link HSLColor} to its {@link RGBColor} representation,
 * rounding each channel to a whole number.
 *
 * @param color The color to convert.
 * @returns The equivalent red/green/blue values, each `0`–`255`.
 * @example
 * hslToRgb({ h: 0, s: 100, l: 50 }); // { r: 255, g: 0, b: 0 }
 * @example
 * hslToRgb({ h: 120, s: 100, l: 50 }); // { r: 0, g: 255, b: 0 }
 */
export function hslToRgb(color: HSLColor): RGBColor {
	let h = normalizeHue(color.h);
	let s = clampChannel(color.s, 0, 100) / 100;
	let l = clampChannel(color.l, 0, 100) / 100;

	if (s === 0) {
		let gray = roundChannel(l * 255);
		return { r: gray, g: gray, b: gray };
	}

	let chroma = (1 - Math.abs(2 * l - 1)) * s;
	let x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
	let m = l - chroma / 2;
	let [r, g, b] = hueSectorRgb(h, chroma, x);

	return {
		r: roundChannel((r + m) * 255),
		g: roundChannel((g + m) * 255),
		b: roundChannel((b + m) * 255),
	};
}

/**
 * Converts an {@link RGBColor} to its {@link HSVColor} representation.
 *
 * @param color The color to convert.
 * @returns The equivalent hue/saturation/value values.
 * @example
 * rgbToHsv({ r: 255, g: 0, b: 0 }); // { h: 0, s: 100, v: 100 }
 * @example
 * rgbToHsv({ r: 0, g: 0, b: 0 }); // { h: 0, s: 0, v: 0 }
 */
export function rgbToHsv(color: RGBColor): HSVColor {
	let r = clampChannel(color.r, 0, 255) / 255;
	let g = clampChannel(color.g, 0, 255) / 255;
	let b = clampChannel(color.b, 0, 255) / 255;

	let max = Math.max(r, g, b);
	let min = Math.min(r, g, b);
	let delta = max - min;
	let s = max === 0 ? 0 : delta / max;

	return { h: computeHue(r, g, b, max, delta), s: s * 100, v: max * 100 };
}

/**
 * Converts an {@link HSVColor} to its {@link RGBColor} representation,
 * rounding each channel to a whole number.
 *
 * @param color The color to convert.
 * @returns The equivalent red/green/blue values, each `0`–`255`.
 * @example
 * hsvToRgb({ h: 0, s: 100, v: 100 }); // { r: 255, g: 0, b: 0 }
 * @example
 * hsvToRgb({ h: 0, s: 0, v: 0 }); // { r: 0, g: 0, b: 0 }
 */
export function hsvToRgb(color: HSVColor): RGBColor {
	let h = normalizeHue(color.h);
	let s = clampChannel(color.s, 0, 100) / 100;
	let v = clampChannel(color.v, 0, 100) / 100;

	if (s === 0) {
		let gray = roundChannel(v * 255);
		return { r: gray, g: gray, b: gray };
	}

	let chroma = v * s;
	let x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
	let m = v - chroma;
	let [r, g, b] = hueSectorRgb(h, chroma, x);

	return {
		r: roundChannel((r + m) * 255),
		g: roundChannel((g + m) * 255),
		b: roundChannel((b + m) * 255),
	};
}

/** Splits the parenthesized contents of an `rgb()`/`rgba()`/`hsl()`/`hsla()` call into its component tokens, accepting both the classic comma-separated form and the space-separated form with an optional `/`-prefixed alpha. */
function tokenizeComponents(content: string): string[] {
	return content
		.replace(/[,/]/g, " ")
		.trim()
		.split(/\s+/)
		.filter((token) => token.length > 0);
}

/** Parses one `rgb()`/`rgba()` channel token — a plain number or a percentage of `255` — to its numeric value, or `null` when `token` matches neither shape. */
function parseRgbChannelToken(token: string): number | null {
	if (token.endsWith("%")) {
		let percent = Number(token.slice(0, -1));
		return Number.isFinite(percent) ? (percent / 100) * 255 : null;
	}

	let value = Number(token);
	return Number.isFinite(value) ? value : null;
}

/** Parses an alpha token — a plain `0`–`1` number or a percentage — to its numeric value; a missing token (no fourth component given) resolves to fully opaque (`1`) rather than failing the parse. */
function parseAlphaToken(token: string | undefined): number | null {
	if (token === undefined) return 1;

	if (token.endsWith("%")) {
		let percent = Number(token.slice(0, -1));
		return Number.isFinite(percent) ? percent / 100 : null;
	}

	let value = Number(token);
	return Number.isFinite(value) ? value : null;
}

/** Parses an `hsl()`/`hsla()` hue token — a plain number optionally suffixed with `deg` — to its numeric degree value, or `null` when `token` matches neither shape. */
function parseHueToken(token: string): number | null {
	let match = /^(-?\d*\.?\d+)(deg)?$/i.exec(token);
	if (match === null) return null;

	let value = Number(match[1]);
	return Number.isFinite(value) ? value : null;
}

/** Parses an `hsl()`/`hsla()` saturation or lightness token — a percentage — to its numeric `0`–`100` value, or `null` when `token` isn't a percentage. */
function parsePercentToken(token: string): number | null {
	if (!token.endsWith("%")) return null;

	let percent = Number(token.slice(0, -1));
	return Number.isFinite(percent) ? percent : null;
}

/** Expands a single hex digit into its doubled two-character form (`"f"` → `"ff"`), the per-channel encoding the shorthand `#rgb`/`#rgba` notation uses. */
function expandHexDigit(digit: string): string {
	return digit + digit;
}

/** Parses the digits of a `#`-prefixed hex color (already stripped of the `#`) into an {@link RGBAColor}, or `null` when `digits` isn't 3, 4, 6, or 8 hex characters long. */
function parseHexDigits(digits: string): RGBAColor | null {
	let channels: string[];
	switch (digits.length) {
		case 3:
			channels = [...Array.from(digits, expandHexDigit), "ff"];
			break;
		case 4:
			channels = Array.from(digits, expandHexDigit);
			break;
		case 6:
			channels = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6), "ff"];
			break;
		case 8:
			channels = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6), digits.slice(6, 8)];
			break;
		default:
			return null;
	}

	let [r, g, b, a] = channels;
	if (r === undefined || g === undefined || b === undefined || a === undefined) return null;

	return {
		r: Number.parseInt(r, 16),
		g: Number.parseInt(g, 16),
		b: Number.parseInt(b, 16),
		a: roundChannel(Number.parseInt(a, 16) / 255, 2),
	};
}

/** Parses the parenthesized contents of an `rgb()`/`rgba()` color into an {@link RGBAColor}, or `null` when `content` doesn't hold 3 or 4 valid components. */
function parseRgbComponents(content: string): RGBAColor | null {
	let tokens = tokenizeComponents(content);
	if (tokens.length !== 3 && tokens.length !== 4) return null;

	let [rToken, gToken, bToken, aToken] = tokens;
	if (rToken === undefined || gToken === undefined || bToken === undefined) return null;

	let r = parseRgbChannelToken(rToken);
	let g = parseRgbChannelToken(gToken);
	let b = parseRgbChannelToken(bToken);
	let a = parseAlphaToken(aToken);
	if (r === null || g === null || b === null || a === null) return null;

	return {
		r: roundChannel(clampChannel(r, 0, 255)),
		g: roundChannel(clampChannel(g, 0, 255)),
		b: roundChannel(clampChannel(b, 0, 255)),
		a: clampChannel(a, 0, 1),
	};
}

/** Parses the parenthesized contents of an `hsl()`/`hsla()` color into an {@link RGBAColor}, converting through {@link hslToRgb}, or `null` when `content` doesn't hold 3 or 4 valid components. */
function parseHslComponents(content: string): RGBAColor | null {
	let tokens = tokenizeComponents(content);
	if (tokens.length !== 3 && tokens.length !== 4) return null;

	let [hToken, sToken, lToken, aToken] = tokens;
	if (hToken === undefined || sToken === undefined || lToken === undefined) return null;

	let h = parseHueToken(hToken);
	let s = parsePercentToken(sToken);
	let l = parsePercentToken(lToken);
	let a = parseAlphaToken(aToken);
	if (h === null || s === null || l === null || a === null) return null;

	let { r, g, b } = hslToRgb({ h, s, l });

	return { r, g, b, a: clampChannel(a, 0, 1) };
}

/**
 * Parses a hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()`,
 * or `hsl()`/`hsla()` color string into its channel values — the shared
 * entry point every color-editing field and swatch reads a raw string value
 * through. Accepts both the classic comma-separated component list and the
 * space-separated list with an optional `/`-prefixed alpha, and tolerates
 * surrounding whitespace. Anything else — a named color, an unsupported
 * notation, or a string that merely resembles one of the three formats
 * without fully matching it — resolves to `null` rather than a partial or
 * best-guess result.
 *
 * @param input The color string to parse.
 * @returns The parsed {@link RGBAColor}, or `null` when `input` doesn't match a supported notation.
 * @example
 * parseColor("#ff0000"); // { r: 255, g: 0, b: 0, a: 1 }
 * @example
 * parseColor("rgba(0, 128, 255, 0.5)"); // { r: 0, g: 128, b: 255, a: 0.5 }
 * @example
 * parseColor("hsl(120deg 100% 50%)"); // { r: 0, g: 255, b: 0, a: 1 }
 * @example
 * parseColor("not-a-color"); // null
 */
export function parseColor(input: string): RGBAColor | null {
	let value = input.trim();

	let hexMatch = /^#([0-9a-fA-F]+)$/.exec(value);
	if (hexMatch !== null) {
		let digits = hexMatch[1];
		return digits === undefined ? null : parseHexDigits(digits);
	}

	let rgbMatch = /^rgba?\(([^)]*)\)$/i.exec(value);
	if (rgbMatch !== null) {
		let content = rgbMatch[1];
		return content === undefined ? null : parseRgbComponents(content);
	}

	let hslMatch = /^hsla?\(([^)]*)\)$/i.exec(value);
	if (hslMatch !== null) {
		let content = hslMatch[1];
		return content === undefined ? null : parseHslComponents(content);
	}

	return null;
}

/** Formats a single `0`–`255` channel as a two-character lowercase hex byte, clamping and rounding it first so an out-of-range or fractional input still produces a valid byte. */
function toHexByte(value: number): string {
	return roundChannel(clampChannel(value, 0, 255))
		.toString(16)
		.padStart(2, "0");
}

/**
 * Formats `color` as a hex string: `#rrggbb` once fully opaque, or
 * `#rrggbbaa` once alpha drops below `1`, so a fully opaque color round-trips
 * through the shorter, more familiar six-character form.
 *
 * @param color The color to format.
 * @returns The formatted hex string, always lowercase.
 * @example
 * formatHex({ r: 255, g: 0, b: 0, a: 1 }); // "#ff0000"
 * @example
 * formatHex({ r: 255, g: 0, b: 0, a: 0.5 }); // "#ff000080"
 */
export function formatHex(color: RGBAColor): string {
	let hex = `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
	let alpha = clampChannel(color.a, 0, 1);

	return alpha >= 1 ? hex : `${hex}${toHexByte(alpha * 255)}`;
}

/**
 * Formats `color` as an `rgb()`/`rgba()` string using the classic
 * comma-separated notation: `rgb(r, g, b)` once fully opaque, or
 * `rgba(r, g, b, a)` once alpha drops below `1`.
 *
 * @param color The color to format.
 * @returns The formatted `rgb()`/`rgba()` string.
 * @example
 * formatRgb({ r: 255, g: 0, b: 0, a: 1 }); // "rgb(255, 0, 0)"
 * @example
 * formatRgb({ r: 255, g: 0, b: 0, a: 0.5 }); // "rgba(255, 0, 0, 0.5)"
 */
export function formatRgb(color: RGBAColor): string {
	let r = roundChannel(clampChannel(color.r, 0, 255));
	let g = roundChannel(clampChannel(color.g, 0, 255));
	let b = roundChannel(clampChannel(color.b, 0, 255));
	let a = clampChannel(color.a, 0, 1);

	return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${roundChannel(a, 2)})`;
}

/**
 * Formats `color` as an `hsl()`/`hsla()` string, converting through
 * {@link rgbToHsl} first: `hsl(h, s%, l%)` once fully opaque, or
 * `hsla(h, s%, l%, a)` once alpha drops below `1`.
 *
 * @param color The color to format.
 * @returns The formatted `hsl()`/`hsla()` string.
 * @example
 * formatHsl({ r: 255, g: 0, b: 0, a: 1 }); // "hsl(0, 100%, 50%)"
 * @example
 * formatHsl({ r: 255, g: 0, b: 0, a: 0.5 }); // "hsla(0, 100%, 50%, 0.5)"
 */
export function formatHsl(color: RGBAColor): string {
	let { h, s, l } = rgbToHsl(color);
	let hue = roundChannel(h);
	let saturation = roundChannel(s);
	let lightness = roundChannel(l);
	let a = clampChannel(color.a, 0, 1);

	return a >= 1
		? `hsl(${hue}, ${saturation}%, ${lightness}%)`
		: `hsla(${hue}, ${saturation}%, ${lightness}%, ${roundChannel(a, 2)})`;
}

export type { Point } from "./geometry";

/**
 * The rectangle a pointer position is measured against — the plain
 * `left`/`top`/`width`/`height` fields an already-known layout measurement
 * provides.
 */
export interface Rect {
	/** Horizontal position of the rectangle's near edge. */
	left: number;
	/** Vertical position of the rectangle's near edge. */
	top: number;
	/** The rectangle's width. */
	width: number;
	/** The rectangle's height. */
	height: number;
}

/**
 * Maps a pointer position to its `[0, 1]` × `[0, 1]` position within `rect`,
 * clamped so a pointer that has drifted past the rectangle's edges still
 * resolves to a point on its border instead of one beyond it — the shared
 * math behind dragging across a two-dimensional picking surface, where each
 * axis drives one paired value. A zero-width or zero-height `rect` resolves
 * every position on that axis to `0` rather than dividing by zero.
 *
 * @param rect The rectangle `point` is measured against.
 * @param point The pointer position to normalize.
 * @returns The normalized, clamped position within `rect`.
 * @example
 * normalizedPointerPosition({ left: 0, top: 0, width: 200, height: 100 }, { x: 100, y: 25 });
 * // { x: 0.5, y: 0.25 }
 * @example
 * normalizedPointerPosition({ left: 0, top: 0, width: 200, height: 100 }, { x: -50, y: 500 });
 * // { x: 0, y: 1 }
 */
export function normalizedPointerPosition(rect: Rect, point: Point): Point {
	let x = rect.width === 0 ? 0 : (point.x - rect.left) / rect.width;
	let y = rect.height === 0 ? 0 : (point.y - rect.top) / rect.height;

	return { x: clampChannel(x, 0, 1), y: clampChannel(y, 0, 1) };
}

/**
 * Computes the clockwise angle, in radians from `0` (straight up, 12
 * o'clock) through the full `[0, 2π)` turn, of `point` as seen from
 * `center` — the shared math behind dragging around a circular control,
 * matching the same clockwise-from-12-o'clock convention a pie or donut
 * wedge's angle span already sweeps through. A `point` exactly on `center`
 * resolves to `0` rather than an undefined direction.
 *
 * @param center The circle's center.
 * @param point The pointer position to measure the angle of.
 * @returns The angle, in radians, clockwise from 12 o'clock, `0`–`2π`.
 * @example
 * angleFromCenter({ x: 0, y: 0 }, { x: 0, y: -10 }); // 0 (straight up)
 * @example
 * angleFromCenter({ x: 0, y: 0 }, { x: 10, y: 0 }); // Math.PI / 2 (3 o'clock)
 */
export function angleFromCenter(center: Point, point: Point): number {
	let dx = point.x - center.x;
	let dy = point.y - center.y;
	if (dx === 0 && dy === 0) return 0;

	return normalizeAngle(Math.atan2(dx, -dy));
}

/**
 * Converts an {@link angleFromCenter}-style angle (radians, clockwise from
 * 12 o'clock) to the hue, in degrees, it represents on a circular hue
 * control — the inverse of {@link hueToAngle}.
 *
 * @param angle The angle, in radians, to convert.
 * @returns The equivalent hue, in degrees, `0`–`360`.
 * @example
 * angleToHue(0); // 0
 * @example
 * angleToHue(Math.PI); // 180
 */
export function angleToHue(angle: number): number {
	return normalizeAngle(angle) * (FULL_TURN_DEGREES / FULL_TURN_RADIANS);
}

/**
 * Converts a hue, in degrees, to its {@link angleFromCenter}-style angle
 * (radians, clockwise from 12 o'clock) on a circular hue control — the
 * inverse of {@link angleToHue}, for placing a control's pointer at the
 * position matching a given hue value.
 *
 * @param hue The hue, in degrees, to convert.
 * @returns The equivalent angle, in radians, clockwise from 12 o'clock.
 * @example
 * hueToAngle(0); // 0
 * @example
 * hueToAngle(180); // Math.PI
 */
export function hueToAngle(hue: number): number {
	return normalizeHue(hue) * (FULL_TURN_RADIANS / FULL_TURN_DEGREES);
}
