/**
 * The drawing surface: premultiplied RGBA in floating point, composited source-over in sRGB
 * the way browsers blend, and quantised to bytes only on output, so stacked translucent
 * layers never accumulate rounding. Layers and masks draw offscreen and composite once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PNG } from "@sdxc/png";

import { encode } from "@sdxc/png";

import type { Shader } from "./paint.js";
import type { Raster } from "./types.js";

import { compilePaint, shadeSpan } from "./paint.js";
import { Path } from "./path.js";
import { rasterize } from "./rasterize.js";
import { fitText } from "./text.js";

/** One drawing surface on the layer stack, with the box its drawing has touched so far. */
interface Layer {
	pixels: Float32Array;
	/** `[left, top, right, bottom]` in whole pixels, right and bottom exclusive; empty when left >= right. */
	bounds: [number, number, number, number];
}

/**
 * A fixed-size image to draw on. Every method draws onto the innermost open layer, so a
 * template can wrap any group of calls in `layer()` or `mask()` without changing them.
 *
 * @example let canvas = new Canvas(1200, 630); canvas.fillRect(0, 0, 1200, 630, color("#0b0c10"))
 */
export class Canvas {
	readonly width: number;
	readonly height: number;
	/** Open layers, innermost last; the first is the canvas itself. */
	#stack: Layer[];
	/** One row of premultiplied colour, reused by every fill to shade a span at a time. */
	#span: Float32Array;
	/** One row of a mask's colour, kept apart from `#span` since compositing reads both. */
	#maskSpan: Float32Array;

	/** Starts fully transparent; paint a background first for an opaque image. */
	constructor(width: number, height: number) {
		this.width = Math.max(1, Math.floor(width));
		this.height = Math.max(1, Math.floor(height));
		this.#stack = [this.#newLayer()];
		this.#span = new Float32Array(this.width * 4);
		this.#maskSpan = new Float32Array(this.width * 4);
	}

	/**
	 * Fills an axis-aligned rectangle. Fractional edges cover their pixels partially, so a
	 * 1 px line placed between two pixels renders as two half-strength ones, exactly as in a
	 * browser.
	 */
	fillRect(x: number, y: number, width: number, height: number, paint: Raster.Paint): void {
		let left = Math.max(0, x);
		let top = Math.max(0, y);
		let right = Math.min(this.width, x + width);
		let bottom = Math.min(this.height, y + height);
		if (right <= left || bottom <= top) return;
		let shader = compilePaint(paint);
		let layer = this.#layer();
		let x0 = Math.floor(left);
		let x1 = Math.ceil(right);
		let count = x1 - x0;
		let columns = new Float32Array(count);
		for (let column = x0; column < x1; column++) {
			columns[column - x0] = Math.min(column + 1, right) - Math.max(column, left);
		}
		let span = this.#span;
		if (shader.kind === "solid") shadeSpan(shader, 0, x0, x1, span);
		for (let row = Math.floor(top); row < Math.ceil(bottom); row++) {
			if (shader.kind !== "solid") shadeSpan(shader, row, x0, x1, span);
			let rowCoverage = Math.min(row + 1, bottom) - Math.max(row, top);
			blendSpan(layer.pixels, (row * this.width + x0) * 4, span, count, columns, 0, rowCoverage);
		}
		touch(layer, x0, Math.floor(top), x1, Math.ceil(bottom));
	}

	/** Fills a path with antialiased edges; overlapping contours combine by `rule`. */
	fillPath(path: Path, paint: Raster.Paint, options: Raster.FillOptions = {}): void {
		let coverage = rasterize(path.segments, this.width, this.height, options.rule);
		if (!coverage) return;
		let shader = compilePaint(paint);
		let layer = this.#layer();
		let span = this.#span;
		let { values, width } = coverage;
		for (let row = 0; row < coverage.height; row++) {
			let rowStart = row * width;
			let first = 0;
			while (first < width && (values[rowStart + first] as number) <= 0) first++;
			if (first === width) continue;
			let last = width;
			while ((values[rowStart + last - 1] as number) <= 0) last--;
			let y = coverage.y + row;
			let x0 = coverage.x + first;
			shadeSpan(shader, y, x0, coverage.x + last, span);
			blendSpan(
				layer.pixels,
				(y * this.width + x0) * 4,
				span,
				last - first,
				values,
				rowStart + first,
				1,
			);
		}
		touch(layer, coverage.x, coverage.y, coverage.x + width, coverage.y + coverage.height);
	}

	/**
	 * Draws `draw`'s calls offscreen and composites the result once at `opacity`, so shapes
	 * that overlap inside the layer fade as one image instead of showing through each other.
	 */
	layer(options: Raster.LayerOptions, draw: () => void): void {
		let opacity = Math.min(1, Math.max(0, options.opacity ?? 1));
		this.#offscreen(draw, null, opacity);
	}

	/**
	 * Draws `draw`'s calls offscreen and composites each pixel scaled by the paint's alpha
	 * there; a radial gradient to transparent fades the group out from its centre.
	 */
	mask(paint: Raster.Paint, draw: () => void): void {
		this.#offscreen(draw, compilePaint(paint), 1);
	}

	/**
	 * Lays out and fills text, wrapping, shrinking and truncating it to the box `options`
	 * describe. Each line fills as one path, so overlapping glyphs never double their ink.
	 *
	 * @returns The fitted size, lines and extent, for placing whatever follows
	 */
	text(content: string, options: Raster.TextOptions): Raster.TextMetrics {
		let fitted = fitText(content, options);
		let paint = options.paint;
		if (paint) {
			fitted.lines.forEach((line, index) => {
				let layout = options.font.layout(line, fitted.size, {
					tracking: fitted.tracking,
					kerning: options.kerning ?? true,
				});
				let align = options.align ?? "start";
				let originX;
				if (align === "center") originX = options.x - layout.width / 2;
				else if (align === "end") originX = options.x - layout.width;
				else originX = options.x;
				let baseline = options.y + index * fitted.size * fitted.lineHeight;
				let path = new Path();
				for (let glyph of layout.glyphs) {
					Path.from(options.font.path(glyph.glyph, fitted.size, originX + glyph.x, baseline), path);
				}
				this.fillPath(path, paint);
			});
		}
		return { size: fitted.size, lines: fitted.lines, width: fitted.width, height: fitted.height };
	}

	/** The metrics `text` would produce, without drawing. */
	measureText(content: string, options: Raster.TextOptions): Raster.TextMetrics {
		let { height, lines, size, width } = fitText(content, options);
		return { size, lines, width, height };
	}

	/**
	 * The image as straight RGBA bytes, the layout of the web's `ImageData` and of
	 * `@sdxc/png`'s `encode`. Layers still open are left out.
	 */
	toImage(): PNG.Image {
		let source = this.#stack[0]?.pixels ?? new Float32Array(0);
		let data = new Uint8ClampedArray(source.length);
		for (let index = 0; index < source.length; index += 4) {
			let alpha = source[index + 3] ?? 0;
			if (alpha <= 0) continue;
			data[index] = Math.round(((source[index] ?? 0) / alpha) * 255);
			data[index + 1] = Math.round(((source[index + 1] ?? 0) / alpha) * 255);
			data[index + 2] = Math.round(((source[index + 2] ?? 0) / alpha) * 255);
			data[index + 3] = Math.round(alpha * 255);
		}
		return { width: this.width, height: this.height, data };
	}

	/** Encodes the image as PNG bytes, ready for a `Response` or storage. */
	toPNG(options?: Parameters<typeof encode>[1]): Promise<Uint8Array> {
		return encode(this.toImage(), options);
	}

	/** A fresh transparent surface the size of the canvas, with nothing drawn on it yet. */
	#newLayer(): Layer {
		return { pixels: new Float32Array(this.width * this.height * 4), bounds: [0, 0, 0, 0] };
	}

	/** The innermost open layer, which every drawing call writes to. */
	#layer(): Layer {
		return this.#stack.at(-1) ?? this.#newLayer();
	}

	/**
	 * Runs `draw` on a fresh transparent layer, then composites it onto the layer beneath,
	 * scaling each pixel by `opacity` and, with a mask, by the mask's alpha there. Only the
	 * box the drawing touched is composited, and the layer is popped even when `draw` throws.
	 */
	#offscreen(draw: () => void, mask: Shader | null, opacity: number): void {
		let layer = this.#newLayer();
		this.#stack.push(layer);
		try {
			draw();
		} finally {
			this.#stack.pop();
		}
		let target = this.#layer();
		let [left, top, right, bottom] = layer.bounds;
		if (right <= left || bottom <= top || opacity <= 0) return;
		let pixels = layer.pixels;
		let maskSpan = this.#maskSpan;
		for (let y = top; y < bottom; y++) {
			if (mask) shadeSpan(mask, y, left, right, maskSpan);
			let offset = (y * this.width + left) * 4;
			for (let index = 0; index < (right - left) * 4; index += 4, offset += 4) {
				let alpha = pixels[offset + 3] as number;
				if (alpha <= 0) continue;
				let scale = mask ? (maskSpan[index + 3] as number) * opacity : opacity;
				if (scale <= 0) continue;
				let keep = 1 - alpha * scale;
				let into = target.pixels;
				into[offset] = (pixels[offset] as number) * scale + (into[offset] as number) * keep;
				into[offset + 1] =
					(pixels[offset + 1] as number) * scale + (into[offset + 1] as number) * keep;
				into[offset + 2] =
					(pixels[offset + 2] as number) * scale + (into[offset + 2] as number) * keep;
				into[offset + 3] = alpha * scale + (into[offset + 3] as number) * keep;
			}
		}
		touch(target, left, top, right, bottom);
	}
}

/**
 * Composites `count` shaded pixels from `span` onto `target` starting at `start`, each at
 * its coverage (`coverages[from + i]` times `rowCoverage`). A fully covered opaque pixel is
 * copied and a transparent one skipped, which together are most of any large fill; colour is
 * premultiplied, so a pixel with no alpha adds nothing.
 */
function blendSpan(
	target: Float32Array,
	start: number,
	span: Float32Array,
	count: number,
	coverages: Float32Array,
	from: number,
	rowCoverage: number,
): void {
	let offset = start;
	for (let index = 0; index < count * 4; index += 4, offset += 4) {
		let coverage = (coverages[from + (index >> 2)] as number) * rowCoverage;
		if (coverage <= 0) continue;
		let alpha = (span[index + 3] as number) * coverage;
		if (alpha <= 0) continue;
		if (alpha >= 1) {
			target[offset] = span[index] as number;
			target[offset + 1] = span[index + 1] as number;
			target[offset + 2] = span[index + 2] as number;
			target[offset + 3] = 1;
			continue;
		}
		let keep = 1 - alpha;
		target[offset] = (span[index] as number) * coverage + (target[offset] as number) * keep;
		target[offset + 1] =
			(span[index + 1] as number) * coverage + (target[offset + 1] as number) * keep;
		target[offset + 2] =
			(span[index + 2] as number) * coverage + (target[offset + 2] as number) * keep;
		target[offset + 3] = alpha + (target[offset + 3] as number) * keep;
	}
}

/** Grows a layer's touched box to include the pixels from `(left, top)` to `(right, bottom)`. */
function touch(layer: Layer, left: number, top: number, right: number, bottom: number): void {
	let bounds = layer.bounds;
	if (bounds[2] <= bounds[0]) {
		layer.bounds = [left, top, right, bottom];
		return;
	}
	layer.bounds = [
		Math.min(bounds[0], left),
		Math.min(bounds[1], top),
		Math.max(bounds[2], right),
		Math.max(bounds[3], bottom),
	];
}
