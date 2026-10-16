/**
 * Checks every colour notation `color()` accepts against the values a browser computes,
 * including oklch tokens and the rejection of malformed input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { color, withAlpha } from "./color.js";

/** Rounds every channel to bytes, the precision a pixel stores. */
function bytes(value: ReturnType<typeof color>) {
	return [value.r, value.g, value.b, value.a].map((channel) => Math.round(channel * 255));
}

describe("color", () => {
	test("reads every hex length", () => {
		expect(bytes(color("#f00"))).toEqual([255, 0, 0, 255]);
		expect(bytes(color("#f008"))).toEqual([255, 0, 0, 136]);
		expect(bytes(color("#0b0c10"))).toEqual([11, 12, 16, 255]);
		expect(bytes(color("#0b0c1080"))).toEqual([11, 12, 16, 128]);
	});

	test("reads rgb() in comma and space forms", () => {
		expect(bytes(color("rgb(10, 20, 30)"))).toEqual([10, 20, 30, 255]);
		expect(bytes(color("rgba(10, 20, 30, 0.5)"))).toEqual([10, 20, 30, 128]);
		expect(bytes(color("rgb(10 20 30 / 50%)"))).toEqual([10, 20, 30, 128]);
		expect(bytes(color("rgb(100% 0% 0%)"))).toEqual([255, 0, 0, 255]);
	});

	test("converts oklch to sRGB as browsers do", () => {
		expect(bytes(color("oklch(1 0 0)"))).toEqual([255, 255, 255, 255]);
		expect(bytes(color("oklch(0 0 0)"))).toEqual([0, 0, 0, 255]);
		expect(bytes(color("oklch(0.628 0.2577 29.23)"))).toEqual([255, 0, 0, 255]);
		expect(bytes(color("oklch(62.8% 0.2577 29.23deg / 0.5)"))).toEqual([255, 0, 0, 128]);
	});

	test("clips out-of-gamut oklch per channel", () => {
		let vivid = color("oklch(0.7 0.4 145)");
		for (let channel of [vivid.r, vivid.g, vivid.b]) {
			expect(channel).toBeGreaterThanOrEqual(0);
			expect(channel).toBeLessThanOrEqual(1);
		}
	});

	test("rejects what it cannot read", () => {
		expect(() => color("tomato")).toThrow(RangeError);
		expect(() => color("#12345")).toThrow(RangeError);
		expect(() => color("rgb(1 2)")).toThrow(RangeError);
		expect(() => color("oklch(a b c)")).toThrow(RangeError);
	});

	test("withAlpha scales the alpha it is given", () => {
		expect(withAlpha(color("#ffffff80"), 0.5).a).toBeCloseTo(0.25, 2);
	});
});
