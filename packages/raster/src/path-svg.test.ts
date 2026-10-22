/**
 * Checks `Path.fromSVG` against paths built by hand: every command absolute and relative,
 * implicit repeats, smooth-curve reflection, arcs measured by the area they fill, compact
 * number syntax, transforms, and the errors malformed data raises.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import type { Raster } from "./types.js";

import { Canvas } from "./canvas.js";
import { color } from "./color.js";
import { Path } from "./path.js";

const RED = color("#f00");

/** Asserts two paths flatten to the same segments, to rounding. */
function expectSamePath(actual: Path, expected: Path): void {
	expect(actual.segments.length).toBe(expected.segments.length);
	actual.segments.forEach((value, index) => {
		expect(value).toBeCloseTo(expected.segments[index] ?? Number.NaN, 9);
	});
}

/** The area `path` covers when filled, in pixels. */
function filledArea(path: Path, size = 200): number {
	let canvas = new Canvas(size, size);
	canvas.fillPath(path, RED);
	let { data } = canvas.toImage();
	let total = 0;
	for (let index = 3; index < data.length; index += 4) total += (data[index] ?? 0) / 255;
	return total;
}

/** Whether the pixel at `(x, y)` is inked once `path` is filled. */
function inks(path: Path, x: number, y: number, size = 100): boolean {
	let canvas = new Canvas(size, size);
	canvas.fillPath(path, RED);
	return (canvas.toImage().data[(y * size + x) * 4 + 3] ?? 0) > 0;
}

describe("lines", () => {
	test("M, L, H and V draw absolute coordinates", () => {
		let expected = new Path().moveTo(1, 2).lineTo(5, 2).lineTo(5, 8).lineTo(1, 8).close();
		expectSamePath(Path.fromSVG("M1 2L5 2V8H1Z"), expected);
	});

	test("m, l, h and v move relative to the pen", () => {
		let expected = new Path().moveTo(1, 2).lineTo(5, 2).lineTo(5, 8).lineTo(1, 8).close();
		expectSamePath(Path.fromSVG("m1 2l4 0v6h-4z"), expected);
	});

	test("matches Path.rect", () => {
		expectSamePath(Path.fromSVG("M0 0H10V10H0Z"), Path.rect(0, 0, 10, 10));
	});

	test("coordinates after M repeat as L, and after m as l", () => {
		expectSamePath(Path.fromSVG("M0 0 10 0 10 10 0 10z"), Path.rect(0, 0, 10, 10));
		expectSamePath(Path.fromSVG("m0 0 10 0 0 10-10 0z"), Path.rect(0, 0, 10, 10));
	});

	test("repeated coordinates repeat any command", () => {
		expectSamePath(Path.fromSVG("M0 0H10V10H0V0"), Path.fromSVG("M0 0H10 10V10H0V0"));
		expectSamePath(Path.fromSVG("M0 0L10 0L10 10"), Path.fromSVG("M0 0L10 0 10 10"));
	});

	test("a contour after z starts relative to the closed one's start", () => {
		let expected = Path.rect(0, 0, 10, 10);
		expected.moveTo(0, 20).lineTo(10, 20).lineTo(10, 30).lineTo(0, 30).close();
		expectSamePath(Path.fromSVG("M0 0h10v10h-10zm0 20h10v10h-10z"), expected);
	});
});

describe("curves", () => {
	test("C and c draw cubic Béziers", () => {
		let expected = new Path().moveTo(10, 10).cubicTo(10, 40, 40, 40, 40, 10).close();
		expectSamePath(Path.fromSVG("M10 10C10 40 40 40 40 10"), expected);
		expectSamePath(Path.fromSVG("M10 10c0 30 30 30 30 0"), expected);
	});

	test("S reflects the previous control point", () => {
		let expected = new Path()
			.moveTo(0, 50)
			.cubicTo(0, 60, 10, 60, 10, 50)
			.cubicTo(10, 40, 20, 40, 20, 50)
			.close();
		expectSamePath(Path.fromSVG("M0 50C0 60 10 60 10 50S20 40 20 50"), expected);
		expectSamePath(Path.fromSVG("M0 50c0 10 10 10 10 0s10-10 10 0"), expected);
	});

	test("S after a line uses the pen as its first control point", () => {
		let expected = new Path().moveTo(0, 0).lineTo(10, 0).cubicTo(10, 0, 20, 10, 20, 0).close();
		expectSamePath(Path.fromSVG("M0 0L10 0S20 10 20 0"), expected);
	});

	test("Q and q fill a parabola's area", () => {
		/** A parabolic segment covers two thirds of the triangle's bounding box. */
		let expected = (2 / 3) * 80 * 40;
		let path = Path.fromSVG("M10 10Q50 90 90 10Z");
		expect(filledArea(path) / expected).toBeCloseTo(1, 2);
		expectSamePath(path, new Path().moveTo(10, 10).quadTo(50, 90, 90, 10).close());
		expectSamePath(Path.fromSVG("M10 10q40 80 80 0z"), path);
	});

	test("T reflects the previous quadratic control point", () => {
		let path = Path.fromSVG("M10 50Q30 90 50 50T90 50Z");
		expect(inks(path, 30, 60)).toBe(true);
		expect(inks(path, 70, 40)).toBe(true);
		let relative = Path.fromSVG("m10 50q20 40 40 0t40 0z");
		expectSamePath(relative, path);
	});

	test("T after a line draws straight", () => {
		expectSamePath(
			Path.fromSVG("M0 0L10 10T20 20"),
			new Path().moveTo(0, 0).lineTo(10, 10).quadTo(10, 10, 20, 20).close(),
		);
	});
});

describe("arcs", () => {
	test("two half arcs fill a circle of area πr²", () => {
		let circle = Path.fromSVG("M10 100A90 90 0 1 0 190 100A90 90 0 1 0 10 100Z");
		expect(filledArea(circle) / (Math.PI * 90 * 90)).toBeCloseTo(1, 2);
		let relative = Path.fromSVG("m10 100a90 90 0 1 0 180 0a90 90 0 1 0-180 0z");
		expectSamePath(relative, circle);
	});

	test("the sweep flag picks the side the arc bulges to", () => {
		let clockwise = Path.fromSVG("M10 50A40 40 0 0 1 90 50Z");
		expect(inks(clockwise, 50, 20)).toBe(true);
		expect(inks(clockwise, 50, 80)).toBe(false);
		let counter = Path.fromSVG("M10 50A40 40 0 0 0 90 50Z");
		expect(inks(counter, 50, 20)).toBe(false);
		expect(inks(counter, 50, 80)).toBe(true);
	});

	test("the large-arc flag picks the longer of the two arcs", () => {
		let angle = 2 * Math.asin(0.8);
		let small = 1250 * (angle - Math.sin(angle));
		let options: Raster.PathDataOptions = { transform: [1, 0, 0, 1, 50, 50] };
		let short = filledArea(Path.fromSVG("M10 50A50 50 0 0 1 90 50Z", options));
		let long = filledArea(Path.fromSVG("M10 50A50 50 0 1 1 90 50Z", options));
		expect(short / small).toBeCloseTo(1, 2);
		expect(long / (Math.PI * 2500 - small)).toBeCloseTo(1, 2);
	});

	test("radii too small to reach the endpoint grow to a half circle", () => {
		let area = filledArea(Path.fromSVG("M10 50A1 1 0 0 1 90 50Z"));
		expect(area / ((Math.PI * 40 * 40) / 2)).toBeCloseTo(1, 2);
	});

	test("a zero radius draws a straight line", () => {
		expectSamePath(Path.fromSVG("M0 0A0 5 0 0 1 10 10"), Path.fromSVG("M0 0L10 10"));
	});

	test("an arc ending where it starts draws nothing", () => {
		expectSamePath(Path.fromSVG("M0 0L10 10A5 5 0 0 1 10 10"), Path.fromSVG("M0 0L10 10"));
	});
});

describe("number syntax", () => {
	test("reads exponents, signs and leading dots", () => {
		expectSamePath(
			Path.fromSVG("M-1.5e-3 0L1E1 +10"),
			new Path().moveTo(-0.0015, 0).lineTo(10, 10).close(),
		);
	});

	test("splits numbers where the next one starts", () => {
		expectSamePath(Path.fromSVG("M.5.5L10-5"), new Path().moveTo(0.5, 0.5).lineTo(10, -5).close());
	});

	test("accepts commas and any whitespace between arguments", () => {
		expectSamePath(Path.fromSVG(" M 0,0\n\tL10 , 10 "), Path.fromSVG("M0 0L10 10"));
	});

	test("reads arc flags written without separators", () => {
		expectSamePath(Path.fromSVG("M0 0a1 1 0 001 1"), Path.fromSVG("M0 0a1 1 0 0 0 1 1"));
		expectSamePath(Path.fromSVG("M0 0a1 1 0 11.5.5"), Path.fromSVG("M0 0a1 1 0 1 1 .5 .5"));
	});

	test("an empty string is an empty path", () => {
		expect(Path.fromSVG("").segments).toEqual([]);
		expect(Path.fromSVG("  ").segments).toEqual([]);
	});
});

describe("transform", () => {
	test("scales and translates every point", () => {
		let path = Path.fromSVG("M0 0H10V10H0Z", { transform: [2, 0, 0, 2, 5, 5] });
		expectSamePath(path, Path.rect(5, 5, 20, 20));
	});

	test("flips a y-up viewBox onto the canvas", () => {
		let path = Path.fromSVG("M0 0H100V100H0Z", { transform: [0.1, 0, 0, -0.1, 0, 1024] });
		expectSamePath(
			path,
			new Path().moveTo(0, 1024).lineTo(10, 1024).lineTo(10, 1014).lineTo(0, 1014).close(),
		);
	});

	test("carries arcs through the transform", () => {
		let circle = Path.fromSVG("M-1 0A1 1 0 1 0 1 0A1 1 0 1 0-1 0Z", {
			transform: [40, 0, 0, 40, 50, 50],
		});
		expect(filledArea(circle, 100) / (Math.PI * 1600)).toBeCloseTo(1, 2);
	});
});

describe("malformed data", () => {
	test.each([
		["L0 0", 0],
		["M0", 2],
		["M0 0L", 5],
		["M0 0X1 2", 4],
		["M0 0L1 1 2", 10],
		["M0 0A1 1 0 2 0 1 1", 11],
		["M0 0L1,,1", 7],
	])("%s throws a RangeError at position %i", (d, position) => {
		expect(() => Path.fromSVG(d)).toThrow(RangeError);
		expect(() => Path.fromSVG(d)).toThrow(`at position ${position}`);
	});
});
