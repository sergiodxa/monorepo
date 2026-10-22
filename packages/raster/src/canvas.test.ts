/**
 * Checks the canvas pixel by pixel: rectangle and path coverage, both fill rules, gradient
 * sampling and padding, layer opacity, masks, and byte output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { Canvas } from "./canvas.js";
import { color, TRANSPARENT } from "./color.js";
import { linearGradient, radialGradient } from "./paint.js";
import { Path } from "./path.js";

const WHITE = color("#fff");
const BLACK = color("#000");
const RED = color("#f00");
const BLUE = color("#00f");

/** The RGBA bytes at one pixel. */
function pixel(canvas: Canvas, x: number, y: number): number[] {
	let { data, width } = canvas.toImage();
	let offset = (y * width + x) * 4;
	return Array.from(data.slice(offset, offset + 4));
}

/** The summed alpha of every pixel, in pixel units, which is a fill's area. */
function inkedArea(canvas: Canvas): number {
	let { data } = canvas.toImage();
	let total = 0;
	for (let index = 3; index < data.length; index += 4) total += (data[index] ?? 0) / 255;
	return total;
}

describe("fillRect", () => {
	test("fills whole pixels exactly", () => {
		let canvas = new Canvas(4, 4);
		canvas.fillRect(1, 1, 2, 2, RED);
		expect(pixel(canvas, 0, 0)).toEqual([0, 0, 0, 0]);
		expect(pixel(canvas, 1, 1)).toEqual([255, 0, 0, 255]);
		expect(pixel(canvas, 2, 2)).toEqual([255, 0, 0, 255]);
		expect(pixel(canvas, 3, 3)).toEqual([0, 0, 0, 0]);
	});

	test("covers a half-pixel edge at half strength", () => {
		let canvas = new Canvas(4, 1);
		canvas.fillRect(0.5, 0, 1, 1, WHITE);
		expect(pixel(canvas, 0, 0)).toEqual([255, 255, 255, 128]);
		expect(pixel(canvas, 1, 0)).toEqual([255, 255, 255, 128]);
	});

	test("clips to the canvas", () => {
		let canvas = new Canvas(2, 2);
		canvas.fillRect(-10, -10, 100, 100, BLUE);
		expect(pixel(canvas, 0, 0)).toEqual([0, 0, 255, 255]);
		expect(pixel(canvas, 1, 1)).toEqual([0, 0, 255, 255]);
	});

	test("blends source-over", () => {
		let canvas = new Canvas(1, 1);
		canvas.fillRect(0, 0, 1, 1, WHITE);
		canvas.fillRect(0, 0, 1, 1, { ...BLACK, a: 0.5 });
		expect(pixel(canvas, 0, 0)).toEqual([128, 128, 128, 255]);
	});
});

describe("fillPath", () => {
	test("a rectangle path covers its area exactly", () => {
		let canvas = new Canvas(10, 10);
		canvas.fillPath(Path.rect(1.25, 2.5, 5.5, 3), WHITE);
		expect(inkedArea(canvas)).toBeCloseTo(16.5, 1);
		expect(pixel(canvas, 3, 3)).toEqual([255, 255, 255, 255]);
	});

	test("a triangle's coverage sums to its area", () => {
		let canvas = new Canvas(20, 20);
		canvas.fillPath(new Path().moveTo(2, 2).lineTo(18, 2).lineTo(2, 18), WHITE);
		expect(inkedArea(canvas)).toBeCloseTo(128, 0);
	});

	test("a circle's coverage approaches πr²", () => {
		let canvas = new Canvas(40, 40);
		canvas.fillPath(Path.roundedRect(5, 5, 30, 30, 15), WHITE);
		expect(inkedArea(canvas)).toBeCloseTo(Math.PI * 15 * 15, -1);
	});

	test("draws regardless of contour direction", () => {
		let clockwise = new Canvas(10, 10);
		clockwise.fillPath(new Path().moveTo(1, 1).lineTo(9, 1).lineTo(9, 9).lineTo(1, 9), WHITE);
		let counter = new Canvas(10, 10);
		counter.fillPath(new Path().moveTo(1, 1).lineTo(1, 9).lineTo(9, 9).lineTo(9, 1), WHITE);
		expect(inkedArea(counter)).toBeCloseTo(inkedArea(clockwise), 3);
	});

	test("evenodd punches a hole where nonzero fills it", () => {
		let shape = () => Path.rect(0, 0, 10, 10).moveTo(3, 3).lineTo(7, 3).lineTo(7, 7).lineTo(3, 7);
		let nonzero = new Canvas(10, 10);
		nonzero.fillPath(shape(), WHITE);
		expect(pixel(nonzero, 5, 5)[3]).toBe(255);
		let evenodd = new Canvas(10, 10);
		evenodd.fillPath(shape(), WHITE, { rule: "evenodd" });
		expect(pixel(evenodd, 5, 5)[3]).toBe(0);
		expect(pixel(evenodd, 1, 1)[3]).toBe(255);
	});

	test("a shape extending past the left edge still fills inside", () => {
		let canvas = new Canvas(10, 4);
		canvas.fillPath(Path.rect(-50, 0, 55, 4), WHITE);
		expect(pixel(canvas, 0, 1)[3]).toBe(255);
		expect(pixel(canvas, 4, 1)[3]).toBe(255);
		expect(pixel(canvas, 5, 1)[3]).toBe(0);
	});

	test("a shape entirely off the canvas draws nothing", () => {
		let canvas = new Canvas(4, 4);
		canvas.fillPath(Path.rect(-20, -20, 5, 5), WHITE);
		canvas.fillPath(Path.rect(10, 10, 5, 5), WHITE);
		expect(inkedArea(canvas)).toBe(0);
	});
});

describe("gradients", () => {
	test("a linear gradient interpolates and pads", () => {
		let canvas = new Canvas(100, 1);
		canvas.fillRect(
			0,
			0,
			100,
			1,
			linearGradient({
				from: [10, 0],
				to: [90, 0],
				stops: [
					[0, BLACK],
					[1, WHITE],
				],
			}),
		);
		expect(pixel(canvas, 0, 0)).toEqual([0, 0, 0, 255]);
		expect(pixel(canvas, 99, 0)).toEqual([255, 255, 255, 255]);
		expect(pixel(canvas, 49, 0)[0]).toBeGreaterThan(120);
		expect(pixel(canvas, 49, 0)[0]).toBeLessThan(135);
	});

	test("a fade to transparent keeps its hue", () => {
		let canvas = new Canvas(100, 1);
		canvas.fillRect(
			0,
			0,
			100,
			1,
			linearGradient({
				from: [0, 0],
				to: [100, 0],
				stops: [
					[0, RED],
					[1, TRANSPARENT],
				],
			}),
		);
		let [r, g, b, a] = pixel(canvas, 50, 0);
		expect([r, g, b]).toEqual([255, 0, 0]);
		expect(a).toBeGreaterThan(110);
		expect(a).toBeLessThan(145);
	});

	test("an elliptical radial gradient reaches offset 1 at each radius", () => {
		let canvas = new Canvas(101, 101);
		canvas.fillRect(
			0,
			0,
			101,
			101,
			radialGradient({
				center: [50.5, 50.5],
				radius: [50, 25],
				stops: [
					[0, WHITE],
					[1, BLACK],
				],
			}),
		);
		expect(pixel(canvas, 50, 50)[0]).toBeGreaterThan(250);
		expect(pixel(canvas, 100, 50)[0]).toBeLessThan(10);
		expect(pixel(canvas, 50, 76)[0]).toBeLessThan(10);
		expect(pixel(canvas, 75, 50)[0]).toBeGreaterThan(110);
	});

	test("unsorted stops sort by offset", () => {
		let canvas = new Canvas(10, 1);
		canvas.fillRect(
			0,
			0,
			10,
			1,
			linearGradient({
				from: [0, 0],
				to: [10, 0],
				stops: [
					[1, WHITE],
					[0, BLACK],
				],
			}),
		);
		expect(pixel(canvas, 0, 0)[0]).toBeLessThan(20);
		expect(pixel(canvas, 9, 0)[0]).toBeGreaterThan(235);
	});
});

describe("layers", () => {
	test("overlapping shapes in a layer fade as one", () => {
		let canvas = new Canvas(2, 1);
		canvas.layer({ opacity: 0.5 }, () => {
			canvas.fillRect(0, 0, 2, 1, RED);
			canvas.fillRect(0, 0, 1, 1, RED);
		});
		expect(pixel(canvas, 0, 0)).toEqual(pixel(canvas, 1, 0));
		expect(pixel(canvas, 0, 0)).toEqual([255, 0, 0, 128]);
	});

	test("a mask scales each pixel by the paint's alpha", () => {
		let canvas = new Canvas(100, 1);
		canvas.mask(
			linearGradient({
				from: [0, 0],
				to: [100, 0],
				stops: [
					[0, WHITE],
					[1, TRANSPARENT],
				],
			}),
			() => {
				canvas.fillRect(0, 0, 100, 1, BLUE);
			},
		);
		expect(pixel(canvas, 0, 0)[3]).toBeGreaterThan(250);
		expect(pixel(canvas, 99, 0)[3]).toBeLessThan(5);
		expect(pixel(canvas, 0, 0).slice(0, 3)).toEqual([0, 0, 255]);
	});

	test("a throwing draw still closes its layer", () => {
		let canvas = new Canvas(1, 1);
		expect(() =>
			canvas.layer({}, () => {
				throw new Error("boom");
			}),
		).toThrow("boom");
		canvas.fillRect(0, 0, 1, 1, RED);
		expect(pixel(canvas, 0, 0)).toEqual([255, 0, 0, 255]);
	});
});
