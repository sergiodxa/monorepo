/**
 * Outline geometry over `Font.Command` lists: SVG path data, the control box and the exact
 * bounding box. Both boxes work on any outline, quadratic or cubic, so TrueType and CFF
 * glyphs, scaled or not, measure through the same code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "./font.js";

/**
 * SVG path data for an outline, coordinates rounded to two decimals. The outline keeps its
 * own axes: an `outline()` in font units has y up, so flip it (or draw `path()`) for SVG's
 * y-down space.
 *
 * @param commands - An outline, from `outline()` or `path()`.
 * @returns Path data such as `"M10 0L20 0Q30 0 30 10Z"`, `""` for no commands.
 * @example `<path d="${toSVGPath(font.path(glyph, 32, 0, 32))}"/>`
 */
export function toSVGPath(commands: readonly Font.Command[]): string {
	let data = "";
	for (let command of commands) {
		if (command.type === "close") data += "Z";
		else if (command.type === "quad") {
			data += `Q${round(command.cx)} ${round(command.cy)} ${round(command.x)} ${round(command.y)}`;
		} else if (command.type === "cubic") {
			data += `C${round(command.c1x)} ${round(command.c1y)} ${round(command.c2x)} ${round(command.c2y)} ${round(command.x)} ${round(command.y)}`;
		} else {
			data += `${command.type === "move" ? "M" : "L"}${round(command.x)} ${round(command.y)}`;
		}
	}
	return data;
}

/**
 * The box around every point of an outline, control points included: cheaper than the
 * exact box and never smaller than it.
 *
 * @param commands - An outline.
 * @returns The box, all zeros for an empty outline.
 */
export function controlBox(commands: readonly Font.Command[]): Font.BBox {
	let box = emptyBox();
	for (let command of commands) {
		if (command.type === "close") continue;
		if (command.type === "quad") extend(box, command.cx, command.cy);
		else if (command.type === "cubic") {
			extend(box, command.c1x, command.c1y);
			extend(box, command.c2x, command.c2y);
		}
		extend(box, command.x, command.y);
	}
	return finish(box);
}

/**
 * The tightest box around an outline: on-curve points plus each curve's extremes, found
 * where the curve's derivative is zero on either axis.
 *
 * @param commands - An outline.
 * @returns The box, all zeros for an empty outline.
 */
export function boundingBox(commands: readonly Font.Command[]): Font.BBox {
	let box = emptyBox();
	let x = 0;
	let y = 0;
	for (let command of commands) {
		if (command.type === "close") continue;
		if (command.type === "quad") {
			curveExtremes(box, [x, command.cx, command.x], [y, command.cy, command.y]);
		} else if (command.type === "cubic") {
			curveExtremes(
				box,
				[x, command.c1x, command.c2x, command.x],
				[y, command.c1y, command.c2y, command.y],
			);
		}
		extend(box, command.x, command.y);
		x = command.x;
		y = command.y;
	}
	return finish(box);
}

/** A box that any point extends; `finish` turns an untouched one into zeros. */
function emptyBox(): Font.BBox {
	return { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity };
}

/**
 * Grows a box to hold a point.
 *
 * @param box - The box, changed in place.
 * @param x - Point x.
 * @param y - Point y.
 */
function extend(box: Font.BBox, x: number, y: number): void {
	box.xMin = Math.min(box.xMin, x);
	box.yMin = Math.min(box.yMin, y);
	box.xMax = Math.max(box.xMax, x);
	box.yMax = Math.max(box.yMax, y);
}

/**
 * An empty outline's box as zeros, so callers never see infinities.
 *
 * @param box - A box built by `extend`.
 */
function finish(box: Font.BBox): Font.BBox {
	return box.xMin > box.xMax ? { xMin: 0, yMin: 0, xMax: 0, yMax: 0 } : box;
}

/**
 * Extends a box by a Bézier curve's interior extremes on each axis, solving the derivative
 * per axis. The curve's end point is added by the caller.
 *
 * @param box - The box, changed in place.
 * @param xs - The curve's x coordinates: start, control point(s), end.
 * @param ys - The curve's y coordinates, in the same order.
 */
function curveExtremes(box: Font.BBox, xs: number[], ys: number[]): void {
	for (let t of derivativeRoots(xs)) {
		let x = bezier(xs, t);
		box.xMin = Math.min(box.xMin, x);
		box.xMax = Math.max(box.xMax, x);
	}
	for (let t of derivativeRoots(ys)) {
		let y = bezier(ys, t);
		box.yMin = Math.min(box.yMin, y);
		box.yMax = Math.max(box.yMax, y);
	}
}

/**
 * The parameters strictly between 0 and 1 where a quadratic or cubic Bézier's derivative is
 * zero along one axis.
 *
 * @param p - The axis coordinates: three for a quadratic, four for a cubic.
 */
function derivativeRoots(p: number[]): number[] {
	let [p0 = 0, p1 = 0, p2 = 0, p3] = p;
	let roots: number[] = [];
	if (p3 === undefined) {
		let denominator = p0 - 2 * p1 + p2;
		if (denominator !== 0) roots.push((p0 - p1) / denominator);
	} else {
		let a = -p0 + 3 * p1 - 3 * p2 + p3;
		let b = 2 * (p0 - 2 * p1 + p2);
		let c = p1 - p0;
		if (Math.abs(a) < 1e-12) {
			if (b !== 0) roots.push(-c / b);
		} else {
			let discriminant = b * b - 4 * a * c;
			if (discriminant >= 0) {
				let root = Math.sqrt(discriminant);
				roots.push((-b + root) / (2 * a), (-b - root) / (2 * a));
			}
		}
	}
	return roots.filter((t) => t > 0 && t < 1);
}

/**
 * A quadratic or cubic Bézier's coordinate on one axis at parameter `t`.
 *
 * @param p - The axis coordinates.
 * @param t - Curve parameter, 0 to 1.
 */
function bezier(p: number[], t: number): number {
	let [p0 = 0, p1 = 0, p2 = 0, p3] = p;
	let u = 1 - t;
	if (p3 === undefined) return u * u * p0 + 2 * u * t * p1 + t * t * p2;
	return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * A coordinate rounded to two decimals, with negative zero written as `0`.
 *
 * @param value - A coordinate.
 */
function round(value: number): number {
	return Math.round(value * 100) / 100 + 0;
}
