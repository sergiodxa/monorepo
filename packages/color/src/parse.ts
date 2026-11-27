/**
 * The CSS color grammar `Color.parse` reads: hex, named colors, `rgb()`, `hsl()`, `hwb()`,
 * `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` in its predefined spaces. It turns
 * each into extended sRGB channels and answers a `Result`, so bad input never throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Rgb } from "./color.js";
import type { Vector } from "./spaces.js";

import { ColorParseError } from "./color-parse-error.js";
import { NAMED_COLORS } from "./named.js";
import {
	RGB_SPACES,
	hslToSrgb,
	hwbToSrgb,
	labToSrgb,
	lchToLab,
	oklabToSrgb,
	oklchToOklab,
	rgbSpaceToSrgb,
} from "./spaces.js";

/** One numeric argument: its value and its unit, `""` for a bare number or `none`. */
interface Token {
	value: number;
	unit: string;
}

/** A function's arguments split into its three channels and an optional alpha. */
interface Arguments {
	channels: [Token, Token, Token];
	alpha: Token | null;
	legacy: boolean;
}

/** A CSS number with an optional unit; `none` is handled before this matches. */
const TOKEN = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/;

/** A CSS function call, capturing its name and everything between the parentheses. */
const FUNCTION = /^([a-z][a-z0-9-]*)\((.*)\)$/s;

/** A hex color in each of its four lengths. */
const HEX = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/;

/** The functions whose arguments may also be written comma-separated. */
const LEGACY_FUNCTIONS = new Set(["rgb", "rgba", "hsl", "hsla"]);

/** Degrees per unit of each CSS angle unit, with a bare number read as degrees. */
const DEGREES_PER_UNIT: Readonly<Record<string, number>> = {
	"": 1,
	deg: 1,
	grad: 0.9,
	rad: 180 / Math.PI,
	turn: 360,
};

/**
 * Reads CSS color text into extended sRGB channels and alpha. Case and surrounding
 * whitespace are ignored; values CSS clamps at parse time (rgb channels, alpha, HSL and
 * Lab lightness, negative chroma) are clamped, and every other value is kept as written.
 *
 * @param input - Any CSS `<color>` except `currentcolor`, system colors and relative syntax.
 * @returns The channels, or a `ColorParseError` that names the rejected text.
 */
export function parseColor(input: string): Result<Rgb, ColorParseError> {
	let text = input.trim().toLowerCase();
	let parsed = readColor(text);
	if (typeof parsed === "string") return failure(new ColorParseError(input, parsed));
	return success(parsed);
}

/** The channels `text` names, or the reason it names none. */
function readColor(text: string): Rgb | string {
	if (text === "") return "empty input";
	if (text.startsWith("#")) return readHex(text);
	if (text === "transparent") return { r: 0, g: 0, b: 0, alpha: 0 };

	let named = NAMED_COLORS[text];
	if (named !== undefined) {
		return {
			r: (named >> 16) / 255,
			g: ((named >> 8) & 0xff) / 255,
			b: (named & 0xff) / 255,
			alpha: 1,
		};
	}

	let call = FUNCTION.exec(text);
	if (call === null) return "not a hex color, a named color or a color function";
	let [, name = "", body = ""] = call;
	if (name === "color") return readColorFunction(body);

	let args = splitArguments(body, LEGACY_FUNCTIONS.has(name));
	if (typeof args === "string") return args;
	return readFunction(name, args);
}

/** The channels of a `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` color. */
function readHex(text: string): Rgb | string {
	if (!HEX.test(text)) return "a hex color has 3, 4, 6 or 8 hex digits";
	let digits = text.slice(1);
	if (digits.length <= 4) digits = digits.replaceAll(/[\da-f]/g, "$&$&");
	let byte = (index: number): number => Number.parseInt(digits.slice(index, index + 2), 16) / 255;
	return { r: byte(0), g: byte(2), b: byte(4), alpha: digits.length === 8 ? byte(6) : 1 };
}

/**
 * Splits a function's arguments. Commas select the legacy syntax, which only `rgb()` and
 * `hsl()` accept and which forbids `none`; otherwise channels are space-separated with an
 * optional `/ alpha`.
 */
function splitArguments(body: string, legacyAllowed: boolean): Arguments | string {
	if (body.includes(",")) {
		if (!legacyAllowed) return "comma-separated arguments are only valid in rgb() and hsl()";
		let parts = body.split(",").map((part) => part.trim());
		if (parts.length !== 3 && parts.length !== 4)
			return "expected 3 channels and an optional alpha";
		if (parts.includes("none")) return "none is not valid in comma-separated syntax";
		return buildArguments(parts, true);
	}

	let [main = "", alpha, ...rest] = body.split("/");
	if (rest.length > 0) return "more than one / in the arguments";
	let parts = main.trim().split(/\s+/);
	if (parts.length !== 3) return "expected 3 channels";
	if (alpha !== undefined) parts.push(alpha.trim());
	return buildArguments(parts, false);
}

/** Reads each argument text into a token, failing on the first one that is not a number. */
function buildArguments(parts: string[], legacy: boolean): Arguments | string {
	let tokens: Token[] = [];
	for (let part of parts) {
		let token = readToken(part);
		if (token === null) return `${JSON.stringify(part)} is not a number, percentage or angle`;
		tokens.push(token);
	}
	let [first, second, third, alpha = null] = tokens;
	if (first === undefined || second === undefined || third === undefined) {
		return "expected 3 channels";
	}
	return { channels: [first, second, third], alpha, legacy };
}

/** One argument as a token, reading `none` as zero, or `null` when it is no CSS number. */
function readToken(text: string): Token | null {
	if (text === "none") return { value: 0, unit: "" };
	let match = TOKEN.exec(text);
	if (match === null) return null;
	return { value: Number(match[1]), unit: match[2] ?? "" };
}

/** Dispatches a named color function to the reader for its space. */
function readFunction(name: string, args: Arguments): Rgb | string {
	let alpha = readAlpha(args.alpha);
	if (alpha === null) return "alpha must be a number or a percentage";
	let vector = readVector(name, args);
	if (typeof vector === "string") return vector;
	return { r: vector[0], g: vector[1], b: vector[2], alpha };
}

/** The sRGB channels a non-`color()` function names, or why its arguments are invalid. */
function readVector(name: string, args: Arguments): Vector | string {
	let [first, second, third] = args.channels;
	switch (name) {
		case "rgb":
		case "rgba":
			return readRgb(args);
		case "hsl":
		case "hsla":
		case "hwb": {
			let hue = readHue(first);
			let x = readPercentLike(second, args.legacy);
			let y = readPercentLike(third, args.legacy);
			if (hue === null || x === null || y === null) return `invalid ${name}() channels`;
			if (name === "hwb") return hwbToSrgb(hue, clamp(x, 0, 1), clamp(y, 0, 1));
			return hslToSrgb(hue, clamp(x, 0, 1), clamp(y, 0, 1));
		}
		case "lab":
		case "lch":
			return readCieLab(name, args.channels);
		case "oklab":
		case "oklch":
			return readOklab(name, args.channels);
		default:
			return `${name}() is not a supported color function`;
	}
}

/** The sRGB channels of `rgb()`: numbers out of 255 or percentages, clamped to 0–1. */
function readRgb(args: Arguments): Vector | string {
	let channels = args.channels.map((token) => {
		if (token.unit === "%") return clamp(token.value / 100, 0, 1);
		if (token.unit === "") return clamp(token.value / 255, 0, 1);
		return null;
	});
	let [r, g, b] = channels;
	if (r == null || g == null || b == null) return "rgb() channels are numbers or percentages";
	return [r, g, b];
}

/** The sRGB channels of `lab()` or `lch()`, where 100% of L is 100, of a/b 125 and of C 150. */
function readCieLab(name: string, channels: [Token, Token, Token]): Vector | string {
	let lightness = readScaled(channels[0], 100);
	if (lightness === null) return `invalid ${name}() lightness`;
	lightness = clamp(lightness, 0, 100);
	if (name === "lab") {
		let a = readScaled(channels[1], 125);
		let b = readScaled(channels[2], 125);
		if (a === null || b === null) return "invalid lab() channels";
		return labToSrgb([lightness, a, b]);
	}
	let chroma = readScaled(channels[1], 150);
	let hue = readHue(channels[2]);
	if (chroma === null || hue === null) return "invalid lch() channels";
	return labToSrgb(lchToLab([lightness, Math.max(chroma, 0), hue]));
}

/** The sRGB channels of `oklab()` or `oklch()`, where 100% of L is 1 and of a, b or C 0.4. */
function readOklab(name: string, channels: [Token, Token, Token]): Vector | string {
	let lightness = readScaled(channels[0], 1);
	if (lightness === null) return `invalid ${name}() lightness`;
	lightness = clamp(lightness, 0, 1);
	if (name === "oklab") {
		let a = readScaled(channels[1], 0.4);
		let b = readScaled(channels[2], 0.4);
		if (a === null || b === null) return "invalid oklab() channels";
		return oklabToSrgb([lightness, a, b]);
	}
	let chroma = readScaled(channels[1], 0.4);
	let hue = readHue(channels[2]);
	if (chroma === null || hue === null) return "invalid oklch() channels";
	return oklabToSrgb(oklchToOklab([lightness, Math.max(chroma, 0), hue]));
}

/** The channels of `color(<space> c1 c2 c3 [/ alpha])`, where 100% of a channel is 1. */
function readColorFunction(body: string): Rgb | string {
	let trimmed = body.trim();
	let spaceEnd = trimmed.search(/\s/);
	if (spaceEnd === -1) return "color() needs a color space and 3 channels";
	let spaceName = trimmed.slice(0, spaceEnd);
	let space = RGB_SPACES[spaceName];
	if (space === undefined) return `${spaceName} is not a supported color() space`;

	let args = splitArguments(trimmed.slice(spaceEnd), false);
	if (typeof args === "string") return args;
	let [x, y, z] = args.channels.map((token) => readScaled(token, 1));
	if (x == null || y == null || z == null) return "color() channels are numbers or percentages";
	let alpha = readAlpha(args.alpha);
	if (alpha === null) return "alpha must be a number or a percentage";

	let [r, g, b] = rgbSpaceToSrgb(space, [x, y, z]);
	return { r, g, b, alpha };
}

/** Alpha as 0–1: a number or a percentage, clamped, and 1 when the color omits it. */
function readAlpha(token: Token | null): number | null {
	if (token === null) return 1;
	let value = readScaled(token, 1);
	return value === null ? null : clamp(value, 0, 1);
}

/** A hue in degrees from a bare number or any CSS angle unit; a percentage is no hue. */
function readHue(token: Token): number | null {
	let degreesPerUnit = DEGREES_PER_UNIT[token.unit];
	return degreesPerUnit === undefined ? null : token.value * degreesPerUnit;
}

/**
 * A number or percentage where 100% equals `scale` and a bare number is taken as is; any
 * other unit is invalid.
 */
function readScaled(token: Token, scale: number): number | null {
	if (token.unit === "%") return (token.value / 100) * scale;
	if (token.unit === "") return token.value;
	return null;
}

/**
 * An HSL or HWB percentage as 0–1. The modern syntax also accepts a bare number on the same
 * 0–100 scale; the legacy comma syntax requires the `%`.
 */
function readPercentLike(token: Token, legacy: boolean): number | null {
	if (token.unit === "%" || (token.unit === "" && !legacy)) return token.value / 100;
	return null;
}

/** `value` limited to `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
