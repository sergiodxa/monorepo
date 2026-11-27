/**
 * Tests for `Color.parse`: every CSS color syntax it accepts, the strings Chrome's
 * getComputedStyle hands back (color-mix results included), and the malformed input it
 * reports as a `ColorParseError` instead of throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, succeeded } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { ColorParseError } from "./color-parse-error.js";
import { Color } from "./color.js";

/** The color `input` parses to, failing the test when it is rejected. */
function parsed(input: string): Color {
	let result = Color.parse(input);
	succeeded(result, `expected ${JSON.stringify(input)} to parse`);
	return result.data;
}

/** Asserts `color`'s sRGB channels and alpha, each within `digits` decimal places. */
function expectRgb(color: Color, expected: [number, number, number, number?], digits = 4): void {
	let { r, g, b, alpha } = color.toRgb();
	expect(r).toBeCloseTo(expected[0], digits);
	expect(g).toBeCloseTo(expected[1], digits);
	expect(b).toBeCloseTo(expected[2], digits);
	expect(alpha).toBeCloseTo(expected[3] ?? 1, digits);
}

describe("hex", () => {
	test.each([
		["#f00", [1, 0, 0, 1]],
		["#f008", [1, 0, 0, 0x88 / 255]],
		["#FF8000", [1, 0x80 / 255, 0, 1]],
		["#ff800080", [1, 0x80 / 255, 0, 0x80 / 255]],
	] as const)("reads %s", (input, expected) => {
		expectRgb(parsed(input), [...expected]);
	});
});

describe("rgb()", () => {
	test.each([
		["rgb(255, 0, 0)", [1, 0, 0, 1]],
		["rgba(255, 0, 0, 0.5)", [1, 0, 0, 0.5]],
		["rgb(100%, 50%, 0%)", [1, 0.5, 0, 1]],
		["rgb(255 128 0)", [1, 128 / 255, 0, 1]],
		["rgb(255 128 0 / 50%)", [1, 128 / 255, 0, 0.5]],
		["rgba(255 128 0/.25)", [1, 128 / 255, 0, 0.25]],
		["rgb(none 255 none)", [0, 1, 0, 1]],
		["RGB( 12.5   0   1e2 )", [12.5 / 255, 0, 100 / 255, 1]],
		["rgba(0, 0, 0, 0)", [0, 0, 0, 0]],
	] as const)("reads %s", (input, expected) => {
		expectRgb(parsed(input), [...expected]);
	});

	test("clamps out-of-range channels and alpha as CSS does", () => {
		expectRgb(parsed("rgb(300 -20 0 / 2)"), [1, 0, 0, 1]);
	});
});

describe("hsl() and hwb()", () => {
	test.each([
		["hsl(120 100% 50%)", [0, 1, 0, 1]],
		["hsla(120, 100%, 50%, .5)", [0, 1, 0, 0.5]],
		["hsl(0.5turn 100% 25%)", [0, 0.5, 0.5, 1]],
		["hsl(3.14159265rad 100% 50%)", [0, 1, 1, 1]],
		["hsl(400grad 0% 50%)", [0.5, 0.5, 0.5, 1]],
		["hsl(240 100 50 / 0.2)", [0, 0, 1, 0.2]],
		["hwb(0 0% 0%)", [1, 0, 0, 1]],
		["hwb(120 20% 20%)", [0.2, 0.8, 0.2, 1]],
		["hwb(0 60% 60%)", [0.5, 0.5, 0.5, 1]],
	] as const)("reads %s", (input, expected) => {
		expectRgb(parsed(input), [...expected]);
	});
});

describe("Oklab and OKLCH", () => {
	test("reads the oklch() Chrome serializes", () => {
		let oklch = parsed("oklch(0.24 0.008 70)").toOklch();
		expect(oklch.l).toBeCloseTo(0.24, 6);
		expect(oklch.c).toBeCloseTo(0.008, 6);
		expect(oklch.h).toBeCloseTo(70, 4);
	});

	test("reads percentages, none and alpha", () => {
		let oklch = parsed("oklch(50% 50% none / 40%)").toOklch();
		expect(oklch.l).toBeCloseTo(0.5, 6);
		expect(oklch.c).toBeCloseTo(0.2, 6);
		expect(oklch.alpha).toBeCloseTo(0.4, 6);
	});

	test("reads red written in Oklab", () => {
		expectRgb(parsed("oklab(0.627955 0.224863 0.125846)"), [1, 0, 0, 1], 3);
	});

	test("reads Oklab percentages, where 100% of a or b is 0.4", () => {
		let oklab = parsed("oklab(40% 25% -50%)").toOklab();
		expect(oklab.l).toBeCloseTo(0.4, 6);
		expect(oklab.a).toBeCloseTo(0.1, 6);
		expect(oklab.b).toBeCloseTo(-0.2, 6);
	});

	test("keeps an OKLCH color outside sRGB without clipping it", () => {
		let color = parsed("oklch(0.7 0.35 150)");
		expect(color.inGamut()).toBe(false);
		expect(color.toOklch().c).toBeCloseTo(0.35, 6);
	});
});

describe("CIE Lab and LCH", () => {
	test("reads white and black", () => {
		expectRgb(parsed("lab(100 0 0)"), [1, 1, 1, 1], 3);
		expectRgb(parsed("lch(0% 0 0)"), [0, 0, 0, 1], 3);
	});

	test("reads red written in Lab and LCH", () => {
		expectRgb(parsed("lab(54.29 80.8 69.89)"), [1, 0, 0, 1], 2);
		expectRgb(parsed("lch(54.29 106.84 40.85)"), [1, 0, 0, 1], 2);
	});
});

describe("color()", () => {
	test.each([
		["color(srgb 1 0.5 0)", [1, 0.5, 0, 1]],
		["color(srgb 100% 50% 0% / 0.5)", [1, 0.5, 0, 0.5]],
		["color(srgb-linear 0.214041 0.214041 0.214041)", [0.5, 0.5, 0.5, 1]],
		["color(display-p3 1 1 1)", [1, 1, 1, 1]],
		["color(xyz-d65 0.95046 1 1.08906)", [1, 1, 1, 1]],
		["color(xyz 0.412391 0.212639 0.019331)", [1, 0, 0, 1]],
		["color(xyz-d50 0.9643 1 0.8251)", [1, 1, 1, 1]],
		["color(a98-rgb 1 1 1)", [1, 1, 1, 1]],
		["color(rec2020 1 1 1)", [1, 1, 1, 1]],
		["color(prophoto-rgb 1 1 1)", [1, 1, 1, 1]],
	] as const)("reads %s", (input, expected) => {
		expectRgb(parsed(input), [...expected], 3);
	});

	test("keeps display-p3 red as extended sRGB past 1 and below 0", () => {
		let color = parsed("color(display-p3 1 0 0)");
		expectRgb(color, [1.093, -0.2267, -0.1501], 3);
		expect(color.inGamut()).toBe(false);
	});

	test("keeps color(srgb) channels outside 0–1", () => {
		expectRgb(parsed("color(srgb 1.2 -0.1 0.5)"), [1.2, -0.1, 0.5, 1]);
	});
});

describe("named colors", () => {
	test.each([
		["red", [1, 0, 0, 1]],
		["RebeccaPurple", [0x66 / 255, 0x33 / 255, 0x99 / 255, 1]],
		["lightgoldenrodyellow", [0xfa / 255, 0xfa / 255, 0xd2 / 255, 1]],
		["transparent", [0, 0, 0, 0]],
	] as const)("reads %s", (input, expected) => {
		expectRgb(parsed(input), [...expected]);
	});
});

describe("getComputedStyle output", () => {
	test.each([
		"rgb(0, 0, 0)",
		"rgba(17, 24, 39, 0.8)",
		"color(srgb 0.5 0 0.5)",
		"color(srgb 0.5 0 0.5 / 0.25)",
		"oklab(0.539985 0.0962 -0.0928)",
		"oklab(0.54 0.096 -0.093 / 0.5)",
		"oklch(0.24 0.008 70)",
		"oklch(0.628 0.2577 29.23 / 0.4)",
		"color(display-p3 0.2 0.4 0.6)",
		"lab(52.2345 40.1645 59.9971)",
		"lch(62.2345 59.2 126.2)",
		"color(srgb-linear 0.1 0.2 0.3)",
	])("reads %s", (input) => {
		expect(Color.parse(input).status).toBe("success");
	});
});

describe("rejection", () => {
	test.each([
		"",
		"   ",
		"#12",
		"#12345",
		"#gggggg",
		"notacolor",
		"currentcolor",
		"rgb(1 2)",
		"rgb(1 2 3 4)",
		"rgb(1, 2 3)",
		"rgb(1, 2, 3, 4, 5)",
		"rgb(none, 0, 0)",
		"rgb(1 2 3 / )",
		"rgb(1 2 3",
		"rgb(1deg 2 3)",
		"hsl(10% 50% 50%)",
		"hsl(120, 100, 50)",
		"oklch(0.5 0.1 10%)",
		"color(foo 1 2 3)",
		"color(srgb 1 2)",
		"rgb(from red r g b)",
		"rgb(1px 2 3)",
		"red blue",
	])("reports %j as a ColorParseError", (input) => {
		let result = Color.parse(input);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(ColorParseError);
			expect(result.error.input).toBe(input);
		}
	});
});

describe("round trips", () => {
	test.each([
		"#663399",
		"rgb(12 200 99 / 0.5)",
		"hsl(210 40% 30%)",
		"oklch(0.7 0.35 150)",
		"oklab(0.3 -0.1 0.05)",
		"color(display-p3 0.9 0.1 0.3)",
		"color(srgb 1.2 -0.1 0.5 / 0.3)",
	])("%s survives every lossless format", (input) => {
		let color = parsed(input);
		for (let format of ["srgb", "oklch", "oklab"] as const) {
			expect(parsed(color.toString(format)).equals(color, 1e-4)).toBe(true);
		}
		expect(parsed(String(color)).equals(color, 1e-4)).toBe(true);
	});

	test("hex round trips exactly", () => {
		expect(parsed("#c0ffee").toString("hex")).toBe("#c0ffee");
		expect(parsed("#c0ffee80").toString("hex")).toBe("#c0ffee80");
	});
});
