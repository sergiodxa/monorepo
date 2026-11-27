/**
 * Tests for interpolation by CSS color-mix rules: `mix` in Oklab, OKLCH and sRGB with
 * premultiplied alpha and each hue arc, and the `scale` and `steps` gradients built on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, expectTypeOf, test } from "vitest";

import { Color } from "./color.js";

const RED = Color.rgb(1, 0, 0);
const BLUE = Color.rgb(0, 0, 1);
const WHITE = Color.rgb(1, 1, 1);
const BLACK = Color.rgb(0, 0, 0);

describe("mix()", () => {
	test("averages Oklab components by default, as color-mix() does", () => {
		let mixed = RED.mix(BLUE).toOklab();
		let red = RED.toOklab();
		let blue = BLUE.toOklab();
		expect(mixed.l).toBeCloseTo((red.l + blue.l) / 2, 9);
		expect(mixed.a).toBeCloseTo((red.a + blue.a) / 2, 9);
		expect(mixed.b).toBeCloseTo((red.b + blue.b) / 2, 9);
	});

	test("averages gamma-encoded channels in sRGB", () => {
		expect(RED.mix(BLUE, 0.5, { space: "srgb" }).equals(Color.rgb(0.5, 0, 0.5))).toBe(true);
	});

	test("amount is the share of the other color", () => {
		expect(RED.mix(BLUE, 0).equals(RED, 1e-9)).toBe(true);
		expect(RED.mix(BLUE, 1).equals(BLUE, 1e-9)).toBe(true);
		expect(BLACK.mix(WHITE, 0.25, { space: "srgb" }).equals(Color.rgb(0.25, 0.25, 0.25))).toBe(
			true,
		);
	});

	test("interpolates premultiplied alpha, so transparent adds no darkness", () => {
		let mixed = Color.rgb(0, 0, 0, 0).mix(RED, 0.5, { space: "srgb" });
		expect(mixed.alpha).toBeCloseTo(0.5, 9);
		expect(mixed.withAlpha(1).equals(RED, 1e-9)).toBe(true);
	});

	test("takes the shorter hue arc in OKLCH by default", () => {
		let from = Color.oklch(0.6, 0.1, 350);
		let to = Color.oklch(0.6, 0.1, 30);
		expect(from.mix(to, 0.5, { space: "oklch" }).toOklch().h).toBeCloseTo(10, 6);
	});

	test("takes the longer arc when asked", () => {
		let from = Color.oklch(0.6, 0.1, 350);
		let to = Color.oklch(0.6, 0.1, 30);
		let hue = from.mix(to, 0.5, { space: "oklch", hue: "longer" }).toOklch().h;
		expect(hue).toBeCloseTo(190, 6);
	});

	test("increasing and decreasing pick the arc by direction", () => {
		let from = Color.oklch(0.6, 0.1, 30);
		let to = Color.oklch(0.6, 0.1, 350);
		expect(from.mix(to, 0.5, { space: "oklch", hue: "increasing" }).toOklch().h).toBeCloseTo(
			190,
			6,
		);
		expect(from.mix(to, 0.5, { space: "oklch", hue: "decreasing" }).toOklch().h).toBeCloseTo(10, 6);
	});

	test("a gray takes the other color's hue in OKLCH instead of passing through red", () => {
		let blueish = Color.oklch(0.6, 0.15, 250);
		let mixed = WHITE.mix(blueish, 0.5, { space: "oklch" }).toOklch();
		expect(mixed.h).toBeCloseTo(250, 4);
		expect(mixed.c).toBeCloseTo(0.075, 4);
	});
});

describe("scale()", () => {
	test("answers the ends at 0 and 1 and clamps outside", () => {
		let scale = Color.scale([RED, BLUE]);
		expect(scale(0).equals(RED, 1e-9)).toBe(true);
		expect(scale(1).equals(BLUE, 1e-9)).toBe(true);
		expect(scale(-1).equals(RED, 1e-9)).toBe(true);
		expect(scale(2).equals(BLUE, 1e-9)).toBe(true);
	});

	test("the midpoint matches mix() in the same space", () => {
		expect(Color.scale([RED, BLUE])(0.5).equals(RED.mix(BLUE), 1e-9)).toBe(true);
		let srgb = Color.scale([RED, BLUE], { space: "srgb" })(0.5);
		expect(srgb.equals(Color.rgb(0.5, 0, 0.5), 1e-9)).toBe(true);
	});

	test("the Oklab midpoint of black and white sits at perceptual middle gray, below sRGB's", () => {
		let oklab = Color.scale([BLACK, WHITE])(0.5).toRgb().r;
		let srgb = Color.scale([BLACK, WHITE], { space: "srgb" })(0.5).toRgb().r;
		expect(srgb).toBeCloseTo(0.5, 9);
		expect(oklab).toBeCloseTo(0.3885, 3);
	});

	test("spaces several stops evenly", () => {
		let scale = Color.scale([RED, WHITE, BLUE], { space: "srgb" });
		expect(scale(0.5).equals(WHITE, 1e-9)).toBe(true);
		expect(scale(0.25).equals(Color.rgb(1, 0.5, 0.5), 1e-9)).toBe(true);
		expect(scale(0.75).equals(Color.rgb(0.5, 0.5, 1), 1e-9)).toBe(true);
	});

	test("one stop is a constant", () => {
		let scale = Color.scale([RED]);
		expect(scale(0.3).equals(RED)).toBe(true);
	});
});

describe("steps()", () => {
	test("answers n colors including both ends", () => {
		let steps = Color.steps([BLACK, WHITE], 5, { space: "srgb" });
		expect(steps.map((color) => color.toRgb().r)).toEqual([0, 0.25, 0.5, 0.75, 1]);
	});

	test("answers the start for one step and nothing for none", () => {
		expect(Color.steps([RED, BLUE], 1)).toHaveLength(1);
		expect(Color.steps([RED, BLUE], 1)[0]?.equals(RED)).toBe(true);
		expect(Color.steps([RED, BLUE], 0)).toEqual([]);
	});

	test("rejects an empty stop list at compile time", () => {
		expectTypeOf<Parameters<typeof Color.scale>[0]>().toEqualTypeOf<readonly [Color, ...Color[]]>();
		expectTypeOf<Parameters<typeof Color.steps>[0]>().toEqualTypeOf<readonly [Color, ...Color[]]>();
		expectTypeOf<[]>().not.toExtend<Parameters<typeof Color.scale>[0]>();
	});
});
