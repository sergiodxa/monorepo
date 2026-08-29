/**
 * Unit tests for the color math in {@link "./color-math"}: every assertion
 * compares known inputs against known outputs as plain value checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	angleFromCenter,
	angleToHue,
	clampChannel,
	formatHex,
	formatHsl,
	formatRgb,
	hslToRgb,
	hsvToRgb,
	hueToAngle,
	normalizedPointerPosition,
	parseColor,
	rgbToHsl,
	rgbToHsv,
	roundChannel,
} from "./color-math";

describe(clampChannel.name, () => {
	test("holds a value already inside the default 0-255 bound unchanged", () => {
		expect(clampChannel(128)).toBe(128);
	});

	test("clamps a value above the default max down to 255", () => {
		expect(clampChannel(300)).toBe(255);
	});

	test("clamps a value below the default min up to 0", () => {
		expect(clampChannel(-10)).toBe(0);
	});

	test("supports a custom bound, e.g. an alpha channel's 0-1 range", () => {
		expect(clampChannel(1.5, 0, 1)).toBe(1);
		expect(clampChannel(-0.5, 0, 1)).toBe(0);
		expect(clampChannel(0.5, 0, 1)).toBe(0.5);
	});

	test("supports a custom bound, e.g. a hue's 0-360 range", () => {
		expect(clampChannel(400, 0, 360)).toBe(360);
	});
});

describe(roundChannel.name, () => {
	test("rounds to the nearest whole number by default", () => {
		expect(roundChannel(127.4)).toBe(127);
		expect(roundChannel(127.6)).toBe(128);
	});

	test("supports a custom precision, e.g. an alpha channel kept to two decimals", () => {
		expect(roundChannel(0.4567, 2)).toBe(0.46);
	});

	test("rounds a negative value toward the nearest whole number", () => {
		expect(roundChannel(-2.4)).toBe(-2);
	});
});

describe(parseColor.name, () => {
	test("parses a 6-digit hex color as fully opaque", () => {
		expect(parseColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("parses a 3-digit shorthand hex color by doubling each digit", () => {
		expect(parseColor("#f00")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("parses an 8-digit hex color's trailing byte as alpha", () => {
		expect(parseColor("#ff000080")).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
	});

	test("parses a 4-digit shorthand hex color's trailing digit as alpha", () => {
		expect(parseColor("#f00f")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("is case-insensitive on hex digits", () => {
		expect(parseColor("#FF0000")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("returns null for a hex string of an unsupported length", () => {
		expect(parseColor("#ff")).toBeNull();
		expect(parseColor("#ff0000f")).toBeNull();
	});

	test("returns null for a hex string with non-hex characters", () => {
		expect(parseColor("#gg0000")).toBeNull();
	});

	test("parses classic comma-separated rgb()", () => {
		expect(parseColor("rgb(255, 0, 0)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("parses comma-separated rgba() with an alpha channel", () => {
		expect(parseColor("rgba(0, 128, 255, 0.5)")).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
	});

	test("parses the modern space-separated rgb() form with a slash-prefixed alpha", () => {
		expect(parseColor("rgb(0 128 255 / 50%)")).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
	});

	test("parses percentage rgb() channels relative to 255", () => {
		expect(parseColor("rgb(100%, 0%, 0%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("clamps an out-of-range rgb() channel instead of rejecting it", () => {
		expect(parseColor("rgb(300, -10, 0)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("parses classic comma-separated hsl()", () => {
		expect(parseColor("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	test("parses space-separated hsl() with a deg-suffixed hue and slash alpha", () => {
		expect(parseColor("hsl(120deg 100% 50% / 0.5)")).toEqual({ r: 0, g: 255, b: 0, a: 0.5 });
	});

	test("returns null when hsl()'s saturation or lightness is missing its percent sign", () => {
		expect(parseColor("hsl(120, 100, 50)")).toBeNull();
	});

	test("returns null for an unsupported color format, like a named color", () => {
		expect(parseColor("red")).toBeNull();
	});

	test("returns null for an empty string", () => {
		expect(parseColor("")).toBeNull();
	});

	test("returns null for rgb() missing its closing parenthesis", () => {
		expect(parseColor("rgb(255, 0, 0")).toBeNull();
	});

	test("returns null for rgb() with the wrong number of components", () => {
		expect(parseColor("rgb(255, 0)")).toBeNull();
	});

	test("returns null for rgb() with a non-numeric component", () => {
		expect(parseColor("rgb(a, b, c)")).toBeNull();
	});

	test("ignores whitespace surrounding the whole string", () => {
		expect(parseColor("  #ff0000  ")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});
});

describe(formatHex.name, () => {
	test("formats a fully opaque color as a 6-character hex string", () => {
		expect(formatHex({ r: 255, g: 0, b: 0, a: 1 })).toBe("#ff0000");
	});

	test("appends a two-character alpha byte once alpha drops below 1", () => {
		expect(formatHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe("#ff000080");
	});

	test("round-trips through parseColor", () => {
		expect(parseColor(formatHex({ r: 12, g: 200, b: 40, a: 1 }))).toEqual({
			r: 12,
			g: 200,
			b: 40,
			a: 1,
		});
	});
});

describe(formatRgb.name, () => {
	test("formats a fully opaque color without an alpha channel", () => {
		expect(formatRgb({ r: 255, g: 0, b: 0, a: 1 })).toBe("rgb(255, 0, 0)");
	});

	test("formats a translucent color as rgba() with its alpha channel", () => {
		expect(formatRgb({ r: 255, g: 0, b: 0, a: 0.5 })).toBe("rgba(255, 0, 0, 0.5)");
	});
});

describe(formatHsl.name, () => {
	test("formats a fully opaque color without an alpha channel", () => {
		expect(formatHsl({ r: 255, g: 0, b: 0, a: 1 })).toBe("hsl(0, 100%, 50%)");
	});

	test("formats a translucent color as hsla() with its alpha channel", () => {
		expect(formatHsl({ r: 0, g: 255, b: 0, a: 0.5 })).toBe("hsla(120, 100%, 50%, 0.5)");
	});
});

describe(rgbToHsl.name, () => {
	test("converts pure red", () => {
		expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
	});

	test("converts pure green", () => {
		expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
	});

	test("converts pure blue", () => {
		expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
	});

	test("converts white to zero saturation and full lightness", () => {
		expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
	});

	test("converts black to zero saturation and zero lightness", () => {
		expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
	});

	test("converts a desaturated gray with hue left at 0", () => {
		let hsl = rgbToHsl({ r: 128, g: 128, b: 128 });

		expect(hsl.h).toBe(0);
		expect(hsl.s).toBe(0);
		expect(hsl.l).toBeCloseTo(50.196, 2);
	});

	test("clamps an out-of-range channel before converting", () => {
		expect(rgbToHsl({ r: 300, g: -10, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
	});
});

describe(hslToRgb.name, () => {
	test("converts back to pure red", () => {
		expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
	});

	test("converts back to pure green", () => {
		expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
	});

	test("converts back to pure blue", () => {
		expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
	});

	test("converts a zero-saturation lightness to a gray of that lightness", () => {
		expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 });
		expect(hslToRgb({ h: 0, s: 0, l: 0 })).toEqual({ r: 0, g: 0, b: 0 });
	});

	test("normalizes an out-of-range hue instead of rejecting it", () => {
		expect(hslToRgb({ h: 480, s: 100, l: 50 })).toEqual(hslToRgb({ h: 120, s: 100, l: 50 }));
		expect(hslToRgb({ h: -120, s: 100, l: 50 })).toEqual(hslToRgb({ h: 240, s: 100, l: 50 }));
	});
});

describe(rgbToHsv.name, () => {
	test("converts pure red", () => {
		expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 });
	});

	test("converts black to zero saturation and zero value", () => {
		expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
	});

	test("converts white to zero saturation and full value", () => {
		expect(rgbToHsv({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, v: 100 });
	});

	test("diverges from lightness for a dark, fully saturated color", () => {
		let hsl = rgbToHsl({ r: 128, g: 0, b: 0 });
		let hsv = rgbToHsv({ r: 128, g: 0, b: 0 });

		expect(hsv.h).toBe(0);
		expect(hsv.s).toBe(100);
		expect(hsv.v).toBeCloseTo(50.196, 2);
		expect(hsl.l).toBeCloseTo(25.098, 2);
		expect(hsv.v).not.toBeCloseTo(hsl.l, 1);
	});
});

describe(hsvToRgb.name, () => {
	test("converts back to pure red", () => {
		expect(hsvToRgb({ h: 0, s: 100, v: 100 })).toEqual({ r: 255, g: 0, b: 0 });
	});

	test("converts back to pure green", () => {
		expect(hsvToRgb({ h: 120, s: 100, v: 100 })).toEqual({ r: 0, g: 255, b: 0 });
	});

	test("converts back to pure blue", () => {
		expect(hsvToRgb({ h: 240, s: 100, v: 100 })).toEqual({ r: 0, g: 0, b: 255 });
	});

	test("converts a zero-saturation value to a gray of that value", () => {
		expect(hsvToRgb({ h: 0, s: 0, v: 0 })).toEqual({ r: 0, g: 0, b: 0 });
	});

	test("round-trips a dark, fully saturated color through rgbToHsv", () => {
		expect(hsvToRgb(rgbToHsv({ r: 128, g: 0, b: 0 }))).toEqual({ r: 128, g: 0, b: 0 });
	});
});

describe(normalizedPointerPosition.name, () => {
	let rect = { left: 0, top: 0, width: 200, height: 100 };

	test("maps the rectangle's center to [0.5, 0.5]", () => {
		expect(normalizedPointerPosition(rect, { x: 100, y: 50 })).toEqual({ x: 0.5, y: 0.5 });
	});

	test("maps the near corner to [0, 0] and the far corner to [1, 1]", () => {
		expect(normalizedPointerPosition(rect, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
		expect(normalizedPointerPosition(rect, { x: 200, y: 100 })).toEqual({ x: 1, y: 1 });
	});

	test("clamps a point outside the rectangle to its nearest border", () => {
		expect(normalizedPointerPosition(rect, { x: -50, y: 500 })).toEqual({ x: 0, y: 1 });
	});

	test("accounts for a rectangle offset from the origin", () => {
		let offset = { left: 50, top: 20, width: 100, height: 50 };

		expect(normalizedPointerPosition(offset, { x: 100, y: 45 })).toEqual({ x: 0.5, y: 0.5 });
	});

	test("resolves every position to 0 for a zero-width or zero-height rectangle", () => {
		let collapsed = { left: 10, top: 10, width: 0, height: 0 };

		expect(normalizedPointerPosition(collapsed, { x: 999, y: -999 })).toEqual({ x: 0, y: 0 });
	});
});

describe(angleFromCenter.name, () => {
	let center = { x: 0, y: 0 };

	test("resolves straight up to 0 (12 o'clock)", () => {
		expect(angleFromCenter(center, { x: 0, y: -10 })).toBeCloseTo(0, 10);
	});

	test("resolves straight right to a quarter turn (3 o'clock)", () => {
		expect(angleFromCenter(center, { x: 10, y: 0 })).toBeCloseTo(Math.PI / 2, 10);
	});

	test("resolves straight down to a half turn (6 o'clock)", () => {
		expect(angleFromCenter(center, { x: 0, y: 10 })).toBeCloseTo(Math.PI, 10);
	});

	test("resolves straight left to a three-quarter turn (9 o'clock)", () => {
		expect(angleFromCenter(center, { x: -10, y: 0 })).toBeCloseTo((3 * Math.PI) / 2, 10);
	});

	test("resolves a point exactly on the center to 0 rather than an undefined direction", () => {
		expect(angleFromCenter(center, { x: 0, y: 0 })).toBe(0);
	});
});

describe(angleToHue.name, () => {
	test("maps 0 radians to hue 0", () => {
		expect(angleToHue(0)).toBe(0);
	});

	test("maps a half turn to hue 180", () => {
		expect(angleToHue(Math.PI)).toBeCloseTo(180, 10);
	});

	test("maps a three-quarter turn to hue 270", () => {
		expect(angleToHue((3 * Math.PI) / 2)).toBeCloseTo(270, 10);
	});

	test("normalizes an angle past a full turn instead of rejecting it", () => {
		expect(angleToHue(2 * Math.PI + Math.PI / 2)).toBeCloseTo(90, 10);
	});
});

describe(hueToAngle.name, () => {
	test("maps hue 0 to 0 radians", () => {
		expect(hueToAngle(0)).toBe(0);
	});

	test("maps hue 180 to a half turn", () => {
		expect(hueToAngle(180)).toBeCloseTo(Math.PI, 10);
	});

	test("normalizes an out-of-range hue instead of rejecting it", () => {
		expect(hueToAngle(400)).toBeCloseTo(hueToAngle(40), 10);
	});

	test("round-trips through angleToHue", () => {
		expect(angleToHue(hueToAngle(200))).toBeCloseTo(200, 10);
	});
});
