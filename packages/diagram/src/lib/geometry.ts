/**
 * Plane geometry the renderers share: where a line leaves a node's outline,
 * the path data for a polyline with rounded bends, and the arrowheads drawn as
 * plain shapes so a page holding several diagrams has no marker ids to collide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SvgElement } from "./tree.js";

import { BACKGROUND, STROKE } from "./style.js";
import { element, num } from "./tree.js";

export interface Point {
	x: number;
	y: number;
}

/** A box by its center, which is how layout places every node. */
export interface Box extends Point {
	width: number;
	height: number;
}

/** The outline a line is clipped to; anything not round or a diamond clips as its box. */
export type Outline = "rect" | "ellipse" | "diamond";

/** What an end of a line carries. */
export type Head =
	| "none"
	| "arrow"
	| "open"
	| "triangle"
	| "diamond"
	| "hollowDiamond"
	| "circle"
	| "cross";

/**
 * @param box - The node
 * @param outline - Its shape
 * @param toward - A point the line runs to, outside the node
 * @returns Where the line from the node's center to `toward` crosses the outline
 */
export function clip(box: Box, outline: Outline, toward: Point): Point {
	let dx = toward.x - box.x;
	let dy = toward.y - box.y;
	if (dx === 0 && dy === 0) return { x: box.x, y: box.y };

	let a = box.width / 2;
	let b = box.height / 2;
	let scale: number;
	if (outline === "ellipse") scale = 1 / Math.hypot(dx / a, dy / b);
	else if (outline === "diamond") scale = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
	else
		scale = Math.min(
			dx === 0 ? Infinity : a / Math.abs(dx),
			dy === 0 ? Infinity : b / Math.abs(dy),
		);

	return { x: box.x + dx * Math.min(scale, 1), y: box.y + dy * Math.min(scale, 1) };
}

/**
 * Path data through every point, each bend rounded by up to `radius` so routed
 * edges read as one stroke.
 *
 * @param points - The polyline, at least two points
 * @param radius - The largest corner radius
 * @returns The `d` attribute
 */
export function pathData(points: readonly Point[], radius = 10): string {
	let [first, ...rest] = points;
	if (!first) return "";
	let d = `M${num(first.x)} ${num(first.y)}`;

	for (let index = 0; index < rest.length; index += 1) {
		let corner = rest[index] as Point;
		let previous = points[index] as Point;
		let next = rest[index + 1];
		if (!next) {
			d += ` L${num(corner.x)} ${num(corner.y)}`;
			continue;
		}
		let cut = Math.min(radius, distance(previous, corner) / 2, distance(corner, next) / 2);
		let start = toward(corner, previous, cut);
		let end = toward(corner, next, cut);
		d += ` L${num(start.x)} ${num(start.y)} Q${num(corner.x)} ${num(corner.y)} ${num(end.x)} ${num(end.y)}`;
	}

	return d;
}

/**
 * Draws a head whose tip touches `tip`, pointing away from `from`. Hollow heads
 * are filled with the background, so they cover the line beneath them.
 *
 * @param head - The kind of head
 * @param tip - Where the head points
 * @param from - The previous point on the line, which sets its direction
 * @returns The shape, and the point the line should stop at so it meets the head's base
 */
export function drawHead(
	head: Head,
	tip: Point,
	from: Point,
): { shape: SvgElement | null; base: Point } {
	let length = distance(from, tip) || 1;
	let ux = (tip.x - from.x) / length;
	let uy = (tip.y - from.y) / length;
	let at = (along: number, across: number): Point => ({
		x: tip.x - ux * along - uy * across,
		y: tip.y - uy * along + ux * across,
	});

	if (head === "none") return { shape: null, base: tip };

	if (head === "arrow" || head === "triangle") {
		let size = head === "arrow" ? 10 : 14;
		let half = head === "arrow" ? 4.5 : 7;
		let points = [tip, at(size, half), at(size, -half)];
		let style = head === "arrow" ? "fill: currentColor" : BACKGROUND;
		return { shape: polygon(points, style), base: at(size - 1, 0) };
	}

	if (head === "open") {
		let points = [at(10, 5), tip, at(10, -5)];
		return {
			shape: element("path", { d: pathData(points, 0), ...STROKE, fill: "none" }),
			base: tip,
		};
	}

	if (head === "diamond" || head === "hollowDiamond") {
		let points = [tip, at(8, 5), at(16, 0), at(8, -5)];
		let style = head === "diamond" ? "fill: currentColor" : BACKGROUND;
		return { shape: polygon(points, style), base: at(15, 0) };
	}

	if (head === "circle") {
		let center = at(5, 0);
		let shape = element("circle", {
			cx: num(center.x),
			cy: num(center.y),
			r: "4",
			...STROKE,
			style: BACKGROUND,
		});
		return { shape, base: at(9, 0) };
	}

	let center = at(6, 0);
	let a = { x: center.x - 4, y: center.y - 4 };
	let d = `M${num(a.x)} ${num(a.y)} l8 8 M${num(a.x)} ${num(a.y + 8)} l8 -8`;
	return { shape: element("path", { d, ...STROKE, fill: "none" }), base: tip };
}

/**
 * @param a - One point
 * @param b - The other
 * @returns The straight-line distance between them
 */
export function distance(a: Point, b: Point): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The point `by` units from `from` along the segment to `to`. */
function toward(from: Point, to: Point, by: number): Point {
	let length = distance(from, to) || 1;
	return {
		x: from.x + ((to.x - from.x) * by) / length,
		y: from.y + ((to.y - from.y) * by) / length,
	};
}

/** A closed outline through the points, stroked and filled as `style` says. */
function polygon(points: readonly Point[], style: string): SvgElement {
	return element("polygon", {
		points: points.map((point) => `${num(point.x)},${num(point.y)}`).join(" "),
		...STROKE,
		"stroke-linejoin": "round",
		style,
	});
}
