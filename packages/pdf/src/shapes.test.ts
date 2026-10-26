/**
 * Tests for lines and rectangles: operators in PDF space, isolated graphics state, and
 * rounded corners that stay within the box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Canvas } from "./canvas.js";

import { drawLine, drawRect } from "./shapes.js";

/** An empty letter-size canvas. */
function canvas(): Canvas {
	return { width: 612, height: 792, ops: [], fonts: new Set(), images: new Set(), links: [] };
}

describe("drawLine", () => {
	test("strokes between two points flipped to PDF space", () => {
		let page = canvas();
		drawLine(page, { from: [40, 76], to: [572, 76], width: 0.5, color: "#999999" });
		expect(page.ops).toEqual(["q\n0.6 0.6 0.6 RG\n0.5 w\n40 716 m\n572 716 l\nS\nQ"]);
	});

	test("defaults to a one-point black stroke", () => {
		let page = canvas();
		drawLine(page, { from: [0, 0], to: [10, 10] });
		expect(page.ops[0]).toContain("0 0 0 RG\n1 w");
	});
});

describe("drawRect", () => {
	test("fills a rectangle from its top-left corner", () => {
		let page = canvas();
		drawRect(page, { x: 10, y: 20, width: 100, height: 50, fill: "#ff0000" });
		expect(page.ops).toEqual(["q\n1 0 0 rg\n10 722 100 50 re\nf\nQ"]);
	});

	test("fills and strokes together", () => {
		let page = canvas();
		drawRect(page, {
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			fill: "#fff",
			stroke: "#000",
			strokeWidth: 2,
		});
		expect(page.ops[0]).toBe("q\n1 1 1 rg\n0 0 0 RG\n2 w\n0 782 10 10 re\nB\nQ");
	});

	test("draws nothing without fill or stroke", () => {
		let page = canvas();
		drawRect(page, { x: 0, y: 0, width: 10, height: 10 });
		expect(page.ops).toEqual([]);
	});

	test("rounds corners with the radius capped at half the shorter side", () => {
		let page = canvas();
		drawRect(page, { x: 0, y: 0, width: 100, height: 10, stroke: "#000", radius: 50 });
		let op = page.ops[0] as string;
		expect(op).toContain("5 782 m");
		expect(op.match(/ c$/gm)).toHaveLength(4);
		expect(op).toContain("\nh\nS\nQ");
	});

	test("reads a malformed color as black", () => {
		let page = canvas();
		drawRect(page, { x: 0, y: 0, width: 1, height: 1, fill: "#zzz" });
		expect(page.ops[0]).toContain("0 0 0 rg");
	});
});
