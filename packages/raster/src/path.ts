/**
 * Builds filled shapes out of contours of lines and Bézier curves, and flattens them into
 * the straight segments the rasterizer covers. Curves split until no chord strays more than
 * a tenth of a pixel from the curve, so flattening never shows at any size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "@sdxc/font";

import type { Raster } from "./types.js";

import { tracePathData } from "./svg-path.js";

/** The furthest a flattened chord may stray from its curve, in pixels. */
const TOLERANCE = 0.1;

/** The handle length that makes a cubic Bézier match a quarter circle to within 0.03%. */
const KAPPA = 0.5522847498;

/**
 * A shape as a list of contours. Every edit flattens immediately into segments of
 * `[x0, y0, x1, y1]`, so filling the same path twice does the curve work once.
 */
export class Path {
	#segments: number[] = [];
	#startX = 0;
	#startY = 0;
	#x = 0;
	#y = 0;
	#open = false;

	/**
	 * Flattened edges, four numbers per segment. A contour still open is closed here with an
	 * edge back to its start, so filling a path never depends on calling `close()` first.
	 */
	get segments(): readonly number[] {
		if (!this.#open || this.#y === this.#startY) return this.#segments;
		return [...this.#segments, this.#x, this.#y, this.#startX, this.#startY];
	}

	/** A rectangle as one clockwise contour. */
	static rect(x: number, y: number, width: number, height: number): Path {
		return new Path()
			.moveTo(x, y)
			.lineTo(x + width, y)
			.lineTo(x + width, y + height)
			.lineTo(x, y + height)
			.close();
	}

	/**
	 * A rectangle with quarter-circle corners; the radius is capped at half the shorter side,
	 * so any radius gives a valid shape and a large one gives a pill.
	 */
	static roundedRect(x: number, y: number, width: number, height: number, radius: number): Path {
		let r = Math.max(0, Math.min(radius, width / 2, height / 2));
		let k = r * KAPPA;
		let right = x + width;
		let bottom = y + height;
		return new Path()
			.moveTo(x + r, y)
			.lineTo(right - r, y)
			.cubicTo(right - r + k, y, right, y + r - k, right, y + r)
			.lineTo(right, bottom - r)
			.cubicTo(right, bottom - r + k, right - r + k, bottom, right - r, bottom)
			.lineTo(x + r, bottom)
			.cubicTo(x + r - k, bottom, x, bottom - r + k, x, bottom - r)
			.lineTo(x, y + r)
			.cubicTo(x, y + r - k, x + r - k, y, x + r, y)
			.close();
	}

	/**
	 * Adopts a command list as `@sdxc/font`'s `path()` returns it, so a run of glyphs fills as
	 * one shape.
	 *
	 * @param commands - Outline commands in pixel space
	 * @param into - An existing path to append to, for many glyphs in one fill
	 */
	static from(commands: Iterable<Font.Command>, into = new Path()): Path {
		for (let command of commands) {
			if (command.type === "move") into.moveTo(command.x, command.y);
			else if (command.type === "line") into.lineTo(command.x, command.y);
			else if (command.type === "quad") into.quadTo(command.cx, command.cy, command.x, command.y);
			else if (command.type === "cubic") {
				into.cubicTo(command.c1x, command.c1y, command.c2x, command.c2y, command.x, command.y);
			} else into.close();
		}
		return into.close();
	}

	/**
	 * Parses an SVG `d` attribute, arcs included. `transform` maps every point in SVG
	 * `matrix(a b c d e f)` order, so a shape drawn in its own `viewBox` lands scaled and placed.
	 *
	 * @throws {RangeError} When `d` is malformed, naming the position
	 * @example Path.fromSVG("M0 0H10V10H0Z")
	 * @example Path.fromSVG(logo, { transform: [0.1, 0, 0, -0.1, 40, 142.4] })
	 */
	static fromSVG(d: string, options: Raster.PathDataOptions = {}): Path {
		return tracePathData(d, new Path(), options.transform);
	}

	/** Starts a new contour, closing the one before it. */
	moveTo(x: number, y: number): this {
		this.close();
		this.#startX = this.#x = x;
		this.#startY = this.#y = y;
		this.#open = true;
		return this;
	}

	/** A straight edge from the pen; with no open contour it starts one at `(x, y)` instead. */
	lineTo(x: number, y: number): this {
		if (!this.#open) return this.moveTo(x, y);
		this.#edge(x, y);
		return this;
	}

	/** A quadratic Bézier, the curve TrueType outlines are drawn with. */
	quadTo(cx: number, cy: number, x: number, y: number): this {
		if (!this.#open) this.moveTo(this.#x, this.#y);
		let x0 = this.#x;
		let y0 = this.#y;
		let deviation = Math.hypot(x0 - 2 * cx + x, y0 - 2 * cy + y);
		let steps = Math.max(1, Math.ceil(Math.sqrt(deviation / (4 * TOLERANCE))));
		for (let step = 1; step <= steps; step++) {
			let t = step / steps;
			let u = 1 - t;
			this.#edge(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
		}
		return this;
	}

	/** A cubic Bézier, the curve SVG and rounded corners are drawn with. */
	cubicTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
		if (!this.#open) this.moveTo(this.#x, this.#y);
		let x0 = this.#x;
		let y0 = this.#y;
		let deviation = Math.max(
			Math.hypot(x0 - 2 * c1x + c2x, y0 - 2 * c1y + c2y),
			Math.hypot(c1x - 2 * c2x + x, c1y - 2 * c2y + y),
		);
		let steps = Math.max(1, Math.ceil(Math.sqrt((3 * deviation) / (4 * TOLERANCE))));
		for (let step = 1; step <= steps; step++) {
			let t = step / steps;
			let u = 1 - t;
			let a = u * u * u;
			let b = 3 * u * u * t;
			let c = 3 * u * t * t;
			let d = t * t * t;
			this.#edge(a * x0 + b * c1x + c * c2x + d * x, a * y0 + b * c1y + c * c2y + d * y);
		}
		return this;
	}

	/** Closes the current contour with a straight edge back to its start. */
	close(): this {
		if (this.#open) {
			this.#edge(this.#startX, this.#startY);
			this.#open = false;
		}
		return this;
	}

	/** Records an edge from the pen to `(x, y)`; horizontal edges add no coverage and are dropped. */
	#edge(x: number, y: number): void {
		if (y !== this.#y) this.#segments.push(this.#x, this.#y, x, y);
		this.#x = x;
		this.#y = y;
	}
}
