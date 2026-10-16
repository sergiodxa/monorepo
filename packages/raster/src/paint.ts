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

/** A paint ready to sample: one premultiplied colour, or a position function into a table. */
export type Shader =
	| { kind: "solid"; rgba: Float32Array }
	| { kind: "gradient"; lut: Float32Array; position(x: number, y: number): number };

/**
 * Compiles a paint for sampling at pixel centres. A gradient's stops are sorted and
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
		return {
			kind: "gradient",
			lut,
			position: (x, y) => ((x - x0) * dx + (y - y0) * dy) / lengthSquared,
		};
	}
	let [cx, cy] = paint.center;
	let [rx, ry] = typeof paint.radius === "number" ? [paint.radius, paint.radius] : paint.radius;
	let invX = 1 / (rx || 1);
	let invY = 1 / (ry || 1);
	return {
		kind: "gradient",
		lut,
		position: (x, y) => Math.hypot((x - cx) * invX, (y - cy) * invY),
	};
}

/**
 * Writes the shader's premultiplied colour at pixel `(x, y)` into `out` at `offset`.
 * Sampling happens at the pixel centre, so a gradient is symmetric across the canvas.
 */
export function sample(shader: Shader, x: number, y: number, out: Float32Array, offset = 0): void {
	if (shader.kind === "solid") {
		out[offset] = shader.rgba[0] ?? 0;
		out[offset + 1] = shader.rgba[1] ?? 0;
		out[offset + 2] = shader.rgba[2] ?? 0;
		out[offset + 3] = shader.rgba[3] ?? 0;
		return;
	}
	let t = shader.position(x + 0.5, y + 0.5);
	let index = Math.round(Math.min(1, Math.max(0, t)) * (LUT_SIZE - 1)) * 4;
	out[offset] = shader.lut[index] ?? 0;
	out[offset + 1] = shader.lut[index + 1] ?? 0;
	out[offset + 2] = shader.lut[index + 2] ?? 0;
	out[offset + 3] = shader.lut[index + 3] ?? 0;
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
