/**
 * Gradient and image constructors, and the compiler that turns any paint into a shader the fill
 * loops sample per pixel. A gradient is pre-baked into a premultiplied lookup table, so a pixel
 * costs one position calculation and four reads whatever the number of stops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { iife } from "@sdxc/iife";

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
 * An image as a paint, placed by `transform` from its own pixels onto the canvas.
 *
 * @example imagePattern({ image, transform: [0.5, 0, 0, 0.5, 600, 120] }) // half size, its corner at (600, 120)
 */
export function imagePattern(options: Omit<Raster.ImagePattern, "kind">): Raster.ImagePattern {
	return { kind: "image", ...options };
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
	| { kind: "radial"; lut: Float32Array; cx: number; cy: number; invX: number; invY: number }
	| {
			kind: "image";
			/** The image premultiplied, four floats per pixel. */
			pixels: Float32Array;
			width: number;
			height: number;
			/** The transform's inverse, mapping a canvas point back into the image. */
			inverse: Raster.Matrix;
	  };

/**
 * Compiles a paint for shading at pixel centres. A gradient's stops are sorted and
 * interpolated in premultiplied sRGB, as CSS does, so a fade to transparent keeps its hue.
 */
export function compilePaint(paint: Raster.Paint): Shader {
	if (!("kind" in paint)) return { kind: "solid", rgba: premultiply(paint) };
	if (paint.kind === "image") return compileImage(paint);
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
	if (shader.kind === "image") {
		shadeImage(shader, y, x0, count, out);
		return;
	}
	let lut = shader.lut;
	let last = LUT_SIZE - 1;
	let py = y + 0.5;
	if (shader.kind === "linear") {
		let t = (x0 + 0.5 - shader.x0) * shader.ux + (py - shader.y0) * shader.uy;
		for (let index = 0; index < count * 4; index += 4) {
			let stopIndex = iife(() => {
				if (t <= 0) return 0;
				if (t >= 1) return last;
				return (t * last + 0.5) | 0;
			});
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

/**
 * Premultiplies an image once and inverts its placement, so shading a pixel is a bilinear read
 * at the point the inverse maps the pixel's centre to. A transform that cannot be inverted
 * collapses the image to nothing and shades transparent.
 */
function compileImage(paint: Raster.ImagePattern): Shader {
	let { data, height, width } = paint.image;
	let pixels = new Float32Array(width * height * 4);
	for (let index = 0; index < pixels.length; index += 4) {
		let alpha = (data[index + 3] ?? 0) / 255;
		pixels[index] = ((data[index] ?? 0) / 255) * alpha;
		pixels[index + 1] = ((data[index + 1] ?? 0) / 255) * alpha;
		pixels[index + 2] = ((data[index + 2] ?? 0) / 255) * alpha;
		pixels[index + 3] = alpha;
	}
	let [a, b, c, d, e, f] = paint.transform ?? [1, 0, 0, 1, 0, 0];
	let determinant = a * d - b * c;
	if (determinant === 0) return { kind: "solid", rgba: new Float32Array(4) };
	let inverse: Raster.Matrix = [
		d / determinant,
		-b / determinant,
		-c / determinant,
		a / determinant,
		(c * f - d * e) / determinant,
		(b * e - a * f) / determinant,
	];
	return { kind: "image", pixels, width, height, inverse };
}

/**
 * Shades a span from an image: each pixel centre maps back into the image and blends its four
 * nearest pixels, clamping at the edges so a shape that overruns the image repeats its border.
 */
function shadeImage(
	shader: Extract<Shader, { kind: "image" }>,
	y: number,
	x0: number,
	count: number,
	out: Float32Array,
): void {
	let { height, inverse, pixels, width } = shader;
	let [a, b, c, d, e, f] = inverse;
	let py = y + 0.5;
	let u = a * (x0 + 0.5) + c * py + e - 0.5;
	let v = b * (x0 + 0.5) + d * py + f - 0.5;
	for (let index = 0; index < count * 4; index += 4) {
		let cu = Math.min(width - 1, Math.max(0, u));
		let cv = Math.min(height - 1, Math.max(0, v));
		let left = Math.floor(cu);
		let top = Math.floor(cv);
		let right = Math.min(width - 1, left + 1);
		let bottom = Math.min(height - 1, top + 1);
		let fx = cu - left;
		let fy = cv - top;
		let p00 = (top * width + left) * 4;
		let p10 = (top * width + right) * 4;
		let p01 = (bottom * width + left) * 4;
		let p11 = (bottom * width + right) * 4;
		for (let channel = 0; channel < 4; channel++) {
			let upper =
				(pixels[p00 + channel] as number) * (1 - fx) + (pixels[p10 + channel] as number) * fx;
			let lower =
				(pixels[p01 + channel] as number) * (1 - fx) + (pixels[p11 + channel] as number) * fx;
			out[index + channel] = upper * (1 - fy) + lower * fy;
		}
		u += a;
		v += b;
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
