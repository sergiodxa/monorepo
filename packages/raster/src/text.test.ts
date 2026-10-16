/**
 * Checks text fitting and drawing with a real TrueType face: wrapping at spaces, shrinking
 * to a line limit, truncation with an ellipsis, alignment, and that the glyphs land as ink.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { describe, expect, test } from "vitest";

import { Canvas } from "./canvas.js";
import { color } from "./color.js";

/** Inter Regular, the face `@sdxc/font` tests against. */
const FONT = (() => {
	let result = parseFont(
		readFileSync(join(import.meta.dirname, "../../font/src/fixtures/inter-regular.ttf")),
	);
	if (result.status === "failure") throw result.error;
	return result.data;
})();

const WHITE = color("#fff");

/** The leftmost and rightmost columns holding any ink, or `null` for a blank canvas. */
function inkedColumns(canvas: Canvas): [number, number] | null {
	let { data, height, width } = canvas.toImage();
	let left = Infinity;
	let right = -Infinity;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if ((data[(y * width + x) * 4 + 3] ?? 0) > 32) {
				left = Math.min(left, x);
				right = Math.max(right, x);
			}
		}
	}
	return Number.isFinite(left) ? [left, right] : null;
}

describe("measureText", () => {
	test("keeps text on one line without a width", () => {
		let metrics = new Canvas(10, 10).measureText("Hello  world", {
			font: FONT,
			size: 20,
			x: 0,
			y: 0,
		});
		expect(metrics.lines).toEqual(["Hello world"]);
		expect(metrics.size).toBe(20);
		expect(metrics.width).toBeCloseTo(FONT.measure("Hello world", 20), 5);
	});

	test("wraps at spaces within the width", () => {
		let metrics = new Canvas(10, 10).measureText("one two three four five six", {
			font: FONT,
			size: 20,
			x: 0,
			y: 0,
			maxWidth: 120,
		});
		expect(metrics.lines.length).toBeGreaterThan(1);
		for (let line of metrics.lines) expect(FONT.measure(line, 20)).toBeLessThanOrEqual(120);
		expect(metrics.lines.join(" ")).toBe("one two three four five six");
	});

	test("breaks a word wider than the box between characters", () => {
		let metrics = new Canvas(10, 10).measureText("supercalifragilistic", {
			font: FONT,
			size: 20,
			x: 0,
			y: 0,
			maxWidth: 60,
		});
		expect(metrics.lines.length).toBeGreaterThan(1);
		expect(metrics.lines.join("")).toBe("supercalifragilistic");
	});

	test("shrinks to fit the line limit before truncating", () => {
		let maxWidth = FONT.measure("A title just too long", 40) - 20;
		let options = { font: FONT, size: 40, x: 0, y: 0, maxWidth, maxLines: 1, minSize: 20 };
		let metrics = new Canvas(10, 10).measureText("A title just too long", options);
		expect(metrics.lines).toEqual(["A title just too long"]);
		expect(metrics.size).toBeLessThan(40);
		expect(metrics.size).toBeGreaterThanOrEqual(20);
	});

	test("truncates with an ellipsis at the smallest size", () => {
		let metrics = new Canvas(10, 10).measureText("word ".repeat(40), {
			font: FONT,
			size: 30,
			x: 0,
			y: 0,
			maxWidth: 300,
			maxLines: 2,
			minSize: 24,
		});
		expect(metrics.size).toBe(24);
		expect(metrics.lines).toHaveLength(2);
		expect(metrics.lines[1]?.endsWith("…")).toBe(true);
		expect(FONT.measure(metrics.lines[1] ?? "", 24)).toBeLessThanOrEqual(300);
		expect(metrics.height).toBeCloseTo(2 * 24 * 1.15, 5);
	});

	test("scales tracking with the fitted size", () => {
		let base = { font: FONT, x: 0, y: 0 };
		let tight = new Canvas(10, 10).measureText("Tracking", { ...base, size: 40, tracking: -2 });
		let loose = new Canvas(10, 10).measureText("Tracking", { ...base, size: 40 });
		expect(loose.width - tight.width).toBeCloseTo(2 * 7, 3);
	});
});

describe("text", () => {
	test("draws ink where the text is", () => {
		let canvas = new Canvas(200, 60);
		canvas.text("Hello", { font: FONT, size: 32, x: 10, y: 40, paint: WHITE });
		let columns = inkedColumns(canvas);
		expect(columns).not.toBeNull();
		expect(columns?.[0]).toBeGreaterThanOrEqual(10);
		expect(columns?.[1]).toBeLessThan(10 + FONT.measure("Hello", 32) + 2);
	});

	test("centres and end-aligns about x", () => {
		let centred = new Canvas(400, 60);
		centred.text("Centre", { font: FONT, size: 32, x: 200, y: 40, align: "center", paint: WHITE });
		let [left = 0, right = 0] = inkedColumns(centred) ?? [];
		expect(Math.abs(200 - left - (right - 200))).toBeLessThan(6);

		let ended = new Canvas(400, 60);
		ended.text("End", { font: FONT, size: 32, x: 390, y: 40, align: "end", paint: WHITE });
		expect(inkedColumns(ended)?.[1]).toBeLessThanOrEqual(390);
		expect(inkedColumns(ended)?.[1]).toBeGreaterThan(380);
	});

	test("without a paint it only measures", () => {
		let canvas = new Canvas(200, 60);
		let metrics = canvas.text("Hello", { font: FONT, size: 32, x: 10, y: 40 });
		expect(metrics.lines).toEqual(["Hello"]);
		expect(inkedColumns(canvas)).toBeNull();
	});
});

describe("toPNG", () => {
	test("encodes the image as a PNG", async () => {
		let canvas = new Canvas(4, 4);
		canvas.fillRect(0, 0, 4, 4, WHITE);
		let bytes = await canvas.toPNG();
		expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	});
});
