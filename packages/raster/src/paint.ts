/**
 * Gradient constructors, and the compiler that turns any paint into a shader the fill loops
 * sample per pixel. A gradient is pre-baked into a premultiplied lookup table, so a pixel
 * costs one position calculation and four reads whatever the number of stops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Raster } from "./types.js";

/** Entries in a gradient's lookup table; enough that adjacent entries differ by under one 8-bit step. */
const LUT_SIZE = 1024;

/**
 * A gradient along a line, padded with its end colours beyond both ends.
 *
 * @example linearGradient({ from: [0, 0], to: [0, 630], stops: [[0, top], [1, bottom]] })
 */
export function linearGradient(
	options: Omit<Raster.LinearGradient, "kind">,
): Raster.LinearGradient {
	return { kind: "linear", ...options };
}

/**
 * A gradient outward from a centre; a `[rx, ry]` radius makes it elliptical.
 *
 * @example radialGradient({ center: [600, 315], radius: 720, stops: [[0, white], [0.75, TRANSPARENT]] })
 */
export function radialGradient(
	options: Omit<Raster.RadialGradient, "kind">,
): Raster.RadialGradient {
	return { kind: "radial", ...options };
}

/**
 * A paint ready to shade: one premultiplied colour, or a gradient's lookup table with the
 * geometry that maps a pixel to its offset along it.
 */
export type Shader =
	| { kind: "solid"; rgba: Float32Array }
	| {
			kind: "linear";
			lut: Float32Array;
			x0: number;
			y0: number;
			/** The direction scaled by its inverse squared length, so a dot product is the offset. */
			ux: number;
			uy: number;
	  }
	| { kind: "radial"; lut: Float32Array; cx: number; cy: number; invX: number; invY: number };

/**
 * Compiles a paint for shading at pixel centres. A gradient's stops are sorted and
 * interpolated in premultiplied sRGB, as CSS does, so a fade to transparent keeps its hue.
 */
export function compilePaint(paint: Raster.Paint): Shader {
	if (!("kind" in paint)) return { kind: "solid", rgba: premultiply(paint) };
	let lut = bake(paint.stops);
	if (paint.kind === "linear") {
		let [x0, y0] = paint.from;
		let dx = paint.to[0] - x0;
		let dy = paint.to[1] - y0;
		let lengthSquared = dx * dx + dy * dy || 1;
		return { kind: "linear", lut, x0, y0, ux: dx / lengthSquared, uy: dy / lengthSquared };
	}
	let [cx, cy] = paint.center;
	let [rx, ry] = typeof paint.radius === "number" ? [paint.radius, paint.radius] : paint.radius;
	return { kind: "radial", lut, cx, cy, invX: 1 / (rx || 1), invY: 1 / (ry || 1) };
}

/**
 * Writes the premultiplied colour of pixels `x0` to `x1` (exclusive) on row `y` into `out`,
 * four floats each from index 0. Sampling happens at pixel centres, so a gradient is
 * symmetric across the canvas; a whole span per call keeps the per-pixel work to arithmetic.
 */
export function shadeSpan(
	shader: Shader,
	y: number,
	x0: number,
	x1: number,
	out: Float32Array,
): void {
	let count = x1 - x0;
	if (shader.kind === "solid") {
		let [r = 0, g = 0, b = 0, a = 0] = shader.rgba;
		for (let index = 0; index < count * 4; index += 4) {
			out[index] = r;
			out[index + 1] = g;
			out[index + 2] = b;
			out[index + 3] = a;
		}
		return;
	}
	let lut = shader.lut;
	let last = LUT_SIZE - 1;
	let py = y + 0.5;
	if (shader.kind === "linear") {
		let t = (x0 + 0.5 - shader.x0) * shader.ux + (py - shader.y0) * shader.uy;
		for (let index = 0; index < count * 4; index += 4) {
			let stopIndex;
			if (t <= 0) stopIndex = 0;
			else if (t >= 1) stopIndex = last;
			else stopIndex = (t * last + 0.5) | 0;
			let entry = stopIndex * 4;
			out[index] = lut[entry] as number;
			out[index + 1] = lut[entry + 1] as number;
			out[index + 2] = lut[entry + 2] as number;
			out[index + 3] = lut[entry + 3] as number;
			t += shader.ux;
		}
		return;
	}
	let dy = (py - shader.cy) * shader.invY;
	let dy2 = dy * dy;
	let dx = (x0 + 0.5 - shader.cx) * shader.invX;
	for (let index = 0; index < count * 4; index += 4) {
		let t = Math.sqrt(dx * dx + dy2);
		let entry = (t >= 1 ? last : (t * last + 0.5) | 0) * 4;
		out[index] = lut[entry] as number;
		out[index + 1] = lut[entry + 1] as number;
		out[index + 2] = lut[entry + 2] as number;
		out[index + 3] = lut[entry + 3] as number;
		dx += shader.invX;
	}
}

/** A colour as premultiplied RGBA, the form every blend in the canvas works in. */
function premultiply(color: Raster.Color): Float32Array {
	return Float32Array.of(color.r * color.a, color.g * color.a, color.b * color.a, color.a);
}

/**
 * Samples the stops into a table. Positions before the first stop take its colour and
 * positions after the last take the last one, which is CSS's padding behaviour.
 */
function bake(stops: Raster.Stop[]): Float32Array {
	let sorted = stops
		.map(([offset, color]) => [Math.min(1, Math.max(0, offset)), premultiply(color)] as const)
		.sort((left, right) => left[0] - right[0]);
	let lut = new Float32Array(LUT_SIZE * 4);
	let first = sorted[0];
	let last = sorted.at(-1);
	if (!first || !last) return lut;
	let next = 0;
	for (let entry = 0; entry < LUT_SIZE; entry++) {
		let t = entry / (LUT_SIZE - 1);
		while (next < sorted.length && (sorted[next]?.[0] ?? 1) < t) next++;
		let before = sorted[next - 1];
		let after = sorted[next];
		let from = before?.[1] ?? first[1];
		let to = after?.[1] ?? last[1];
		let mix =
			before && after && after[0] > before[0] ? (t - before[0]) / (after[0] - before[0]) : 0;
		if (!after) mix = 0;
		for (let channel = 0; channel < 4; channel++) {
			let a = (after ? from : to)[channel] ?? 0;
			let b = to[channel] ?? 0;
			lut[entry * 4 + channel] = a + (b - a) * mix;
		}
	}
	return lut;
}
