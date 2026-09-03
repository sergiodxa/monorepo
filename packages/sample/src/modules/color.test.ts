/**
 * Tests for colors: that each notation returns the channel count it should,
 * that every channel lands inside its own range, and that asking for CSS
 * returns something a stylesheet would accept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { en } from "../data/en.js";
import { createRandom } from "../random.js";

import { createColorModule } from "./color.js";

function module(seed: string) {
	return createColorModule(createRandom(seed), en);
}

function channels(value: string | number[]): number[] {
	if (!Array.isArray(value)) throw new Error(`expected channels, got ${value}`);
	return value;
}

describe("human and spaces", () => {
	test("names a color from the dataset", () => {
		expect(en.colorNames).toContain(module("colors").human());
	});

	test("names a CSS color space and function", () => {
		let color = module("spaces");

		expect(color.space()).toMatch(/^[a-z0-9-]+$/i);
		expect(color.cssSupportedSpace()).toMatch(/^[a-z0-9-]+$/i);
		expect(color.cssSupportedFunction()).toMatch(/^[a-z]+$/);
	});
});

describe("rgb", () => {
	test("returns hex by default", () => {
		let color = module("rgb");

		for (let count = 0; count < 50; count++) {
			expect(color.rgb()).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	test("returns channels in range when asked for values", () => {
		let color = module("rgb");

		for (let channel of channels(color.rgb({ format: "values" }))) {
			expect(channel).toBeGreaterThanOrEqual(0);
			expect(channel).toBeLessThanOrEqual(255);
		}
	});

	test("adds an alpha channel on request", () => {
		expect(channels(module("rgb").rgb({ format: "values", includeAlpha: true }))).toHaveLength(4);
	});

	test("writes CSS notation on request", () => {
		expect(module("rgb").rgb({ format: "css" })).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
	});
});

describe("the other notations", () => {
	test("hsl keeps hue in degrees and the rest in percent", () => {
		let [hue, saturation, lightness] = channels(module("hsl").hsl()) as number[];

		expect(hue).toBeGreaterThanOrEqual(0);
		expect(hue).toBeLessThanOrEqual(360);
		expect(saturation).toBeLessThanOrEqual(100);
		expect(lightness).toBeLessThanOrEqual(100);
	});

	test("hwb, lab and lch return three channels", () => {
		let color = module("channels");

		expect(channels(color.hwb())).toHaveLength(3);
		expect(channels(color.lab())).toHaveLength(3);
		expect(channels(color.lch())).toHaveLength(3);
	});

	test("cmyk returns four channels in zero to one", () => {
		for (let channel of channels(module("cmyk").cmyk())) {
			expect(channel).toBeGreaterThanOrEqual(0);
			expect(channel).toBeLessThanOrEqual(1);
		}
	});

	test("writes CSS notation for each", () => {
		let color = module("css");

		expect(color.hsl({ format: "css" })).toMatch(/^hsl\(/);
		expect(color.lab({ format: "css" })).toMatch(/^lab\(/);
		expect(color.colorByCSSColorSpace({ format: "css" })).toMatch(/^color\(/);
	});

	test("writes the space it was given", () => {
		expect(module("space").colorByCSSColorSpace({ format: "css", space: "display-p3" })).toContain(
			"display-p3",
		);
	});
});

describe("determinism", () => {
	test("replays from the seed", () => {
		expect(module("fixed").rgb()).toBe(module("fixed").rgb());
	});
});
