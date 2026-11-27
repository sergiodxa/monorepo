/**
 * Tests for the `Color` value: its numeric constructors, the CSS it prints, the plain
 * objects it converts to, gamut mapping, compositing, and the OKLCH adjustments that
 * each return a new color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { succeeded } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { Hsl, Oklab, Oklch, Rgb } from "./color.js";

import { ColorParseError } from "./color-parse-error.js";
import { Color } from "./color.js";

/** The color `input` parses to, failing the test when it is rejected. */
function parsed(input: string): Color {
	let result = Color.parse(input);
	succeeded(result, `expected ${JSON.stringify(input)} to parse`);
	return result.data;
}

describe("constructors", () => {
	test("rgb() takes unclamped 0–1 channels and an alpha that defaults to 1", () => {
		expect(Color.rgb(1, 0.5, 0).toRgb()).toEqual({ r: 1, g: 0.5, b: 0, alpha: 1 });
		expect(Color.rgb(1.2, -0.1, 0, 0.5).toRgb()).toEqual({ r: 1.2, g: -0.1, b: 0, alpha: 0.5 });
	});

	test("clamps alpha to 0–1 and reads a non-finite number as 0", () => {
		expect(Color.rgb(0, 0, 0, 3).alpha).toBe(1);
		expect(Color.rgb(Number.NaN, 0, 0, -1).toRgb()).toEqual({ r: 0, g: 0, b: 0, alpha: 0 });
	});

	test("hsl() and hwb() take hue in degrees and the rest as 0–1", () => {
		expect(Color.hsl(120, 1, 0.5).equals(Color.rgb(0, 1, 0))).toBe(true);
		expect(Color.hsl(-240, 1, 0.5).equals(Color.rgb(0, 1, 0))).toBe(true);
		expect(Color.hwb(0, 0.6, 0.6, 0.5).equals(Color.rgb(0.5, 0.5, 0.5, 0.5))).toBe(true);
	});

	test("oklch() and oklab() describe the same color", () => {
		let fromLch = Color.oklch(0.6, 0.15, 90);
		let fromLab = Color.oklab(0.6, 0.15 * Math.cos(Math.PI / 2), 0.15);
		expect(fromLch.equals(fromLab, 1e-9)).toBe(true);
	});

	test("instances are frozen", () => {
		expect(Object.isFrozen(Color.rgb(0, 0, 0))).toBe(true);
	});
});

describe("conversion", () => {
	test("toOklab() and toOklch() match the published Oklab values for sRGB red", () => {
		let oklab = Color.rgb(1, 0, 0).toOklab();
		expect(oklab.l).toBeCloseTo(0.627955, 5);
		expect(oklab.a).toBeCloseTo(0.224863, 5);
		expect(oklab.b).toBeCloseTo(0.125846, 5);
		let oklch = Color.rgb(1, 0, 0).toOklch();
		expect(oklch.c).toBeCloseTo(0.257683, 5);
		expect(oklch.h).toBeCloseTo(29.2339, 3);
	});

	test("white is L=1 with no chroma and a hue of 0", () => {
		let oklch = Color.rgb(1, 1, 1).toOklch();
		expect(oklch.l).toBeCloseTo(1, 6);
		expect(oklch.c).toBeCloseTo(0, 6);
		expect(oklch.h).toBe(0);
	});

	test("toHsl() describes the color in degrees and 0–1 fractions", () => {
		let hsl = parsed("#336699").toHsl();
		expect(hsl.h).toBeCloseTo(210, 6);
		expect(hsl.s).toBeCloseTo(0.5, 6);
		expect(hsl.l).toBeCloseTo(0.4, 6);
		expect(hsl.alpha).toBe(1);
	});

	test("an authored hue on a gray does not survive", () => {
		expect(Color.oklch(0.5, 0, 200).toOklch().h).toBe(0);
	});

	test("equals() compares within an epsilon", () => {
		expect(Color.rgb(0.5, 0.5, 0.5).equals(Color.rgb(0.5000001, 0.5, 0.5))).toBe(true);
		expect(Color.rgb(0.5, 0.5, 0.5).equals(Color.rgb(0.51, 0.5, 0.5))).toBe(false);
		expect(Color.rgb(0.5, 0.5, 0.5).equals(Color.rgb(0.51, 0.5, 0.5), 0.02)).toBe(true);
		expect(Color.rgb(0, 0, 0, 1).equals(Color.rgb(0, 0, 0, 0.5))).toBe(false);
	});
});

describe("toString()", () => {
	test("prints rgb() in gamut and oklch() outside it", () => {
		expect(Color.rgb(1, 0.5, 0).toString()).toBe("rgb(255 127.5 0)");
		expect(Color.rgb(1, 0, 0, 0.5).toString()).toBe("rgb(255 0 0 / 0.5)");
		expect(String(parsed("oklch(0.7 0.35 150)"))).toBe("oklch(0.7 0.35 150)");
	});

	test("prints every explicit format", () => {
		let color = parsed("#336699");
		expect(color.toString("hex")).toBe("#336699");
		expect(color.toString("rgb")).toBe("rgb(51 102 153)");
		expect(color.toString("hsl")).toBe("hsl(210 50% 40%)");
		expect(color.toString("srgb")).toBe("color(srgb 0.2 0.4 0.6)");
		expect(color.toString("oklch")).toMatch(/^oklch\(0\.49\d+ 0\.09\d+ 250\.\d+\)$/);
		expect(color.toString("oklab")).toMatch(/^oklab\(0\.49\d+ -0\.0\d+ -0\.09\d+\)$/);
	});

	test("adds alpha to every format below 1", () => {
		let color = Color.rgb(0.2, 0.4, 0.6, 0.25);
		expect(color.toString("hex")).toBe("#33669940");
		expect(color.toString("hsl")).toBe("hsl(210 50% 40% / 0.25)");
		expect(color.toString("srgb")).toBe("color(srgb 0.2 0.4 0.6 / 0.25)");
		expect(color.toString("oklch")).toMatch(/ \/ 0\.25\)$/);
	});

	test("gamut-maps hex, rgb and hsl but keeps srgb lossless", () => {
		let wide = parsed("color(display-p3 1 0 0)");
		expect(wide.toString("hex")).toMatch(/^#[0-9a-f]{6}$/);
		expect(wide.toString("rgb")).not.toMatch(/-/);
		expect(wide.toString("srgb")).toBe("color(srgb 1.093066 -0.226742 -0.150135)");
	});
});

describe("gamut mapping", () => {
	test("inGamut() accepts sRGB and rejects extended channels", () => {
		expect(Color.rgb(1, 0, 0).inGamut()).toBe(true);
		expect(Color.rgb(1.01, 0, 0).inGamut()).toBe(false);
	});

	test("an in-gamut color maps to itself", () => {
		let color = parsed("#336699");
		expect(color.toGamut()).toBe(color);
	});

	test("reduces chroma while keeping lightness and hue close", () => {
		let wide = parsed("oklch(0.7 0.35 150)");
		let mapped = wide.toGamut();
		expect(mapped.inGamut()).toBe(true);
		let before = wide.toOklch();
		let after = mapped.toOklch();
		expect(after.c).toBeLessThan(before.c);
		expect(after.l).toBeCloseTo(before.l, 1);
		expect(Math.abs(after.h - before.h)).toBeLessThan(3);
	});

	test("maps a lightness past 1 to white and below 0 to black", () => {
		expect(
			Color.oklch(1.2, 0.2, 40)
				.toGamut()
				.equals(Color.rgb(1, 1, 1)),
		).toBe(true);
		expect(
			Color.oklch(-0.1, 0.2, 40, 0.5)
				.toGamut()
				.equals(Color.rgb(0, 0, 0, 0.5)),
		).toBe(true);
	});

	test("maps display-p3 red to a red, not a per-channel clip", () => {
		let mapped = parsed("color(display-p3 1 0 0)").toGamut().toRgb();
		expect(mapped.r).toBeGreaterThan(0.95);
		expect(mapped.g).toBeLessThan(0.1);
		expect(mapped.b).toBeLessThan(0.1);
	});
});

describe("over()", () => {
	test("paints half-transparent black over white as mid gray", () => {
		let gray = Color.rgb(0, 0, 0, 0.5).over(Color.rgb(1, 1, 1));
		expect(gray.equals(Color.rgb(0.5, 0.5, 0.5))).toBe(true);
	});

	test("composites two translucent layers with source-over", () => {
		let result = Color.rgb(1, 0, 0, 0.5).over(Color.rgb(0, 0, 1, 0.5));
		expect(result.alpha).toBeCloseTo(0.75, 9);
		expect(result.toRgb().r).toBeCloseTo(2 / 3, 9);
		expect(result.toRgb().b).toBeCloseTo(1 / 3, 9);
	});

	test("an opaque source hides the background, and two transparent layers stay transparent", () => {
		expect(
			Color.rgb(1, 0, 0)
				.over(Color.rgb(0, 0, 1))
				.equals(Color.rgb(1, 0, 0)),
		).toBe(true);
		expect(Color.rgb(1, 0, 0, 0).over(Color.rgb(0, 0, 1, 0)).alpha).toBe(0);
	});
});

describe("adjustments", () => {
	let base = Color.oklch(0.5, 0.1, 200, 0.8);

	test("darken(0.1) is 10% darker and lighten(0.1) 10% lighter in OKLCH lightness", () => {
		expect(base.darken(0.1).toOklch().l).toBeCloseTo(0.45, 9);
		expect(base.lighten(0.1).toOklch().l).toBeCloseTo(0.55, 9);
		expect(base.darken(0.1).toOklch().c).toBeCloseTo(0.1, 9);
		expect(base.darken(0.1).toOklch().h).toBeCloseTo(200, 6);
		expect(base.darken(0.1).alpha).toBeCloseTo(0.8, 9);
	});

	test("lightness clamps to 0–1", () => {
		expect(Color.oklch(0.8, 0, 0).lighten(1).toOklch().l).toBeCloseTo(1, 9);
		expect(base.darken(2).toOklch().l).toBeCloseTo(0, 9);
	});

	test("saturate() and desaturate() scale chroma", () => {
		expect(base.saturate(0.5).toOklch().c).toBeCloseTo(0.15, 9);
		expect(base.desaturate(0.5).toOklch().c).toBeCloseTo(0.05, 9);
		expect(base.desaturate(2).toOklch().c).toBeCloseTo(0, 9);
	});

	test("rotate() and complement() turn the OKLCH hue", () => {
		expect(base.rotate(200).toOklch().h).toBeCloseTo(40, 6);
		expect(base.rotate(-240).toOklch().h).toBeCloseTo(320, 6);
		expect(base.complement().toOklch().h).toBeCloseTo(20, 6);
	});

	test("grayscale() keeps OKLCH lightness and drops chroma", () => {
		let gray = base.grayscale().toOklch();
		expect(gray.l).toBeCloseTo(0.5, 9);
		expect(gray.c).toBeCloseTo(0, 6);
	});

	test("invert() inverts each sRGB channel and keeps alpha", () => {
		expect(
			Color.rgb(1, 0.25, 0, 0.5)
				.invert()
				.equals(Color.rgb(0, 0.75, 1, 0.5)),
		).toBe(true);
	});

	test("withAlpha() sets alpha and fade() scales it", () => {
		expect(base.withAlpha(0.3).alpha).toBe(0.3);
		expect(base.fade(0.5).alpha).toBeCloseTo(0.4, 9);
	});

	test("with() sets exact OKLCH values and keeps the rest", () => {
		let changed = base.with({ lightness: 0.9, hue: 10 }).toOklch();
		expect(changed.l).toBeCloseTo(0.9, 9);
		expect(changed.c).toBeCloseTo(0.1, 9);
		expect(changed.h).toBeCloseTo(10, 6);
		expect(changed.alpha).toBeCloseTo(0.8, 9);
	});

	test("every operation returns a new color and leaves the original alone", () => {
		let before = base.toString("srgb");
		base.lighten(0.5).rotate(90).withAlpha(0.1);
		expect(base.toString("srgb")).toBe(before);
	});
});

describe("types", () => {
	test("parse() answers a Result instead of throwing", () => {
		expectTypeOf(Color.parse("red")).toEqualTypeOf<Result<Color, ColorParseError>>();
	});

	test("the converters answer plain objects", () => {
		expectTypeOf(Color.rgb(0, 0, 0).toRgb()).toEqualTypeOf<Rgb>();
		expectTypeOf(Color.rgb(0, 0, 0).toHsl()).toEqualTypeOf<Hsl>();
		expectTypeOf(Color.rgb(0, 0, 0).toOklch()).toEqualTypeOf<Oklch>();
		expectTypeOf(Color.rgb(0, 0, 0).toOklab()).toEqualTypeOf<Oklab>();
	});

	test("toString() takes only the formats it prints", () => {
		expectTypeOf<Parameters<Color["toString"]>[0]>().toEqualTypeOf<
			"hex" | "rgb" | "hsl" | "oklch" | "oklab" | "srgb" | undefined
		>();
	});
});
