/**
 * Tests for WCAG 2.1 contrast: known ratios, the pass flags at each level, how a
 * translucent color is composited before measuring, `ensureContrast` reaching a target
 * or reporting the best it could, and `contrastingText`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, succeeded } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Color } from "./color.js";
import { ContrastUnreachableError } from "./contrast-unreachable-error.js";

/** The color `input` parses to, failing the test when it is rejected. */
function parsed(input: string): Color {
	let result = Color.parse(input);
	succeeded(result, `expected ${JSON.stringify(input)} to parse`);
	return result.data;
}

const BLACK = Color.rgb(0, 0, 0);
const WHITE = Color.rgb(1, 1, 1);

describe("contrast()", () => {
	test("black on white is 21:1 and passes everything", () => {
		let result = BLACK.contrast(WHITE);
		expect(result.algorithm).toBe("WCAG21");
		expect(result.ratio).toBeCloseTo(21, 9);
		expect(result.aa).toEqual({ text: true, largeText: true, nonText: true });
		expect(result.aaa).toEqual({ text: true, largeText: true });
	});

	test("a color against itself is 1:1 and fails everything", () => {
		let result = Color.contrast(WHITE, WHITE);
		expect(result.ratio).toBe(1);
		expect(result.aa).toEqual({ text: false, largeText: false, nonText: false });
	});

	test("#777 on white is about 4.48, failing AA text but passing large text", () => {
		let result = parsed("#777").contrast(WHITE);
		expect(result.ratio).toBeCloseTo(4.478, 3);
		expect(result.aa).toEqual({ text: false, largeText: true, nonText: true });
		expect(result.aaa).toEqual({ text: false, largeText: false });
	});

	test("#767676 on white is the lightest gray passing AA text", () => {
		let result = parsed("#767676").contrast(WHITE);
		expect(result.ratio).toBeCloseTo(4.542, 3);
		expect(result.aa.text).toBe(true);
		expect(result.aaa.largeText).toBe(true);
	});

	test("matches published ratios for chromatic pairs", () => {
		expect(parsed("#0000ff").contrast(WHITE).ratio).toBeCloseTo(8.592, 3);
		expect(parsed("#ff0000").contrast(WHITE).ratio).toBeCloseTo(3.998, 3);
		expect(parsed("#ffff00").contrast(BLACK).ratio).toBeCloseTo(19.556, 3);
	});

	test("is symmetric for opaque colors", () => {
		let a = parsed("#336699");
		let b = parsed("#f0e68c");
		expect(a.contrast(b).ratio).toBe(b.contrast(a).ratio);
		expect(Color.contrast(a, b).ratio).toBe(a.contrast(b).ratio);
	});

	test("paints a translucent foreground over the background first", () => {
		let shadow = Color.rgb(0, 0, 0, 0.5);
		let painted = shadow.over(WHITE);
		expect(shadow.contrast(WHITE).ratio).toBeCloseTo(painted.contrast(WHITE).ratio, 9);
		expect(shadow.contrast(WHITE).ratio).toBeLessThan(5);
	});

	test("paints a translucent background over white first", () => {
		let wash = Color.rgb(0, 0, 0, 0.5);
		expect(BLACK.contrast(wash).ratio).toBeCloseTo(BLACK.contrast(wash.over(WHITE)).ratio, 9);
	});

	test("measures a wide-gamut color as its sRGB gamut mapping", () => {
		let wide = parsed("color(display-p3 1 0 0)");
		expect(wide.contrast(WHITE).ratio).toBeCloseTo(wide.toGamut().contrast(WHITE).ratio, 9);
	});
});

describe("ensureContrast()", () => {
	test("answers the color itself when it already reaches the ratio", () => {
		let result = BLACK.ensureContrast(WHITE, 4.5);
		succeeded(result);
		expect(result.data).toBe(BLACK);
	});

	test("darkens #777 on white just enough to reach AA", () => {
		let gray = parsed("#777");
		let result = gray.ensureContrast(WHITE, 4.5);
		succeeded(result);
		let ratio = result.data.contrast(WHITE).ratio;
		expect(ratio).toBeGreaterThanOrEqual(4.5);
		expect(ratio).toBeLessThan(4.52);
		expect(result.data.toOklch().l).toBeLessThan(gray.toOklch().l);
	});

	test("keeps hue and chroma while it moves lightness", () => {
		let brand = Color.oklch(0.7, 0.1, 250);
		let result = brand.ensureContrast(WHITE, 4.5);
		succeeded(result);
		let { c, h } = result.data.toOklch();
		expect(c).toBeCloseTo(0.1, 3);
		expect(h).toBeCloseTo(250, 1);
	});

	test("lightens when only lighter colors can reach the ratio", () => {
		let navy = parsed("#000080");
		let fg = parsed("#333");
		let result = fg.ensureContrast(navy, 7);
		succeeded(result);
		expect(result.data.toOklch().l).toBeGreaterThan(fg.toOklch().l);
		expect(result.data.contrast(navy).ratio).toBeGreaterThanOrEqual(7);
	});

	test("picks the direction closest to the original lightness", () => {
		let mid = parsed("#888");
		let lightish = Color.oklch(0.65, 0, 0);
		let result = lightish.ensureContrast(mid, 1.5);
		succeeded(result);
		expect(result.data.toOklch().l).toBeGreaterThan(0.65);
	});

	test("reports the best reachable color when no lightness reaches the ratio", () => {
		let result = parsed("#777").ensureContrast(parsed("#777"), 7);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(ContrastUnreachableError);
			expect(result.error.target).toBe(7);
			expect(result.error.best.equals(BLACK, 1e-6)).toBe(true);
			expect(result.error.ratio).toBeCloseTo(BLACK.contrast(parsed("#777")).ratio, 9);
		}
	});

	test("a ratio past what black or white reach fails", () => {
		expect(isSuccess(parsed("#123").ensureContrast(WHITE, 15))).toBe(true);
		expect(isFailure(parsed("#123").ensureContrast(parsed("#eee"), 21))).toBe(true);
	});
});

describe("contrastingText()", () => {
	test.each([
		["#ffffff", BLACK],
		["#000000", WHITE],
		["#ffeb3b", BLACK],
		["#1e3a8a", WHITE],
		["#777777", BLACK],
	] as const)("answers the better of black and white on %s", (background, expected) => {
		expect(parsed(background).contrastingText().equals(expected)).toBe(true);
	});
});
