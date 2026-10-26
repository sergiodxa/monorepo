/**
 * Lines and rectangles, written as path operators inside their own graphics state so a
 * shape's color and width never leak into what is drawn after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Canvas } from "./canvas.js";
import type { Color } from "./color.js";

import { fill, stroke } from "./color.js";
import { num } from "./objects.js";

/** How far a cubic Bézier's control points sit along the tangents to draw a quarter circle. */
const KAPPA = 0.5522847498;

/** A straight stroke between two points, in top-down page coordinates. */
export interface LineOptions {
	from: [number, number];
	to: [number, number];
	/**
	 * Stroke width in points.
	 * @default 1
	 */
	width?: number;
	/**
	 * @default "#000000"
	 */
	color?: Color;
}

/** A rectangle with its top-left corner at `(x, y)`; with neither `fill` nor `stroke` it draws nothing. */
export interface RectOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	fill?: Color;
	stroke?: Color;
	/**
	 * Width of the outline when `stroke` is set.
	 * @default 1
	 */
	strokeWidth?: number;
	/**
	 * Corner radius, capped at half the shorter side.
	 * @default 0
	 */
	radius?: number;
}

/**
 * Strokes a straight line.
 *
 * @param canvas - The page drawn on.
 * @param options - Endpoints, width and color.
 */
export function drawLine(canvas: Canvas, options: LineOptions): void {
	let [x1, y1] = options.from;
	let [x2, y2] = options.to;
	canvas.ops.push(
		[
			"q",
			stroke(options.color ?? "#000000"),
			`${num(options.width ?? 1)} w`,
			`${num(x1)} ${num(canvas.height - y1)} m`,
			`${num(x2)} ${num(canvas.height - y2)} l`,
			"S",
			"Q",
		].join("\n"),
	);
}

/**
 * Fills and/or strokes a rectangle, rounding its corners when `radius` is above zero.
 *
 * @param canvas - The page drawn on.
 * @param options - Box, paint and radius.
 */
export function drawRect(canvas: Canvas, options: RectOptions): void {
	if (options.fill === undefined && options.stroke === undefined) return;
	let ops = ["q"];
	if (options.fill !== undefined) ops.push(fill(options.fill));
	if (options.stroke !== undefined) {
		ops.push(stroke(options.stroke), `${num(options.strokeWidth ?? 1)} w`);
	}
	let { x, width, height } = options;
	let bottom = canvas.height - options.y - height;
	let radius = Math.max(0, Math.min(options.radius ?? 0, width / 2, height / 2));
	if (radius === 0) ops.push(`${num(x)} ${num(bottom)} ${num(width)} ${num(height)} re`);
	else ops.push(...roundedPath(x, bottom, width, height, radius));
	if (options.fill !== undefined && options.stroke !== undefined) ops.push("B");
	else if (options.fill !== undefined) ops.push("f");
	else ops.push("S");
	ops.push("Q");
	canvas.ops.push(ops.join("\n"));
}

/**
 * A closed rounded-rectangle path in PDF space, each corner a quarter circle drawn as one
 * cubic Bézier, starting at the bottom edge and running counter-clockwise.
 */
function roundedPath(x: number, y: number, width: number, height: number, r: number): string[] {
	let k = r * KAPPA;
	let right = x + width;
	let top = y + height;
	let point = (px: number, py: number) => `${num(px)} ${num(py)}`;
	return [
		`${point(x + r, y)} m`,
		`${point(right - r, y)} l`,
		`${point(right - r + k, y)} ${point(right, y + r - k)} ${point(right, y + r)} c`,
		`${point(right, top - r)} l`,
		`${point(right, top - r + k)} ${point(right - r + k, top)} ${point(right - r, top)} c`,
		`${point(x + r, top)} l`,
		`${point(x + r - k, top)} ${point(x, top - r + k)} ${point(x, top - r)} c`,
		`${point(x, y + r)} l`,
		`${point(x, y + r - k)} ${point(x + r - k, y)} ${point(x + r, y)} c`,
		"h",
	];
}
