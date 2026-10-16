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

import { compilePaint, sample } from "./paint.js";
import { Path } from "./path.js";
import { rasterize } from "./rasterize.js";
import { fitText } from "./text.js";

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
	#stack: Float32Array[];
	/** One premultiplied pixel of scratch space for sampling paints. */
	#pixel = new Float32Array(4);

	/** Starts fully transparent; paint a background first for an opaque image. */
	constructor(width: number, height: number) {
		this.width = Math.max(1, Math.floor(width));
		this.height = Math.max(1, Math.floor(height));
		this.#stack = [new Float32Array(this.width * this.height * 4)];
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
		for (let row = Math.floor(top); row < Math.ceil(bottom); row++) {
			let rowCoverage = Math.min(row + 1, bottom) - Math.max(row, top);
			for (let column = Math.floor(left); column < Math.ceil(right); column++) {
				let columnCoverage = Math.min(column + 1, right) - Math.max(column, left);
				this.#blend(shader, column, row, rowCoverage * columnCoverage);
			}
		}
	}

	/** Fills a path with antialiased edges; overlapping contours combine by `rule`. */
	fillPath(path: Path, paint: Raster.Paint, options: Raster.FillOptions = {}): void {
		let coverage = rasterize(path.segments, this.width, this.height, options.rule);
		if (!coverage) return;
		let shader = compilePaint(paint);
		for (let row = 0; row < coverage.height; row++) {
			for (let column = 0; column < coverage.width; column++) {
				let amount = coverage.values[row * coverage.width + column] ?? 0;
				if (amount > 0) this.#blend(shader, coverage.x + column, coverage.y + row, amount);
			}
		}
	}

	/**
	 * Draws `draw`'s calls offscreen and composites the result once at `opacity`, so shapes
	 * that overlap inside the layer fade as one image instead of showing through each other.
	 */
	layer(options: Raster.LayerOptions, draw: () => void): void {
		let opacity = Math.min(1, Math.max(0, options.opacity ?? 1));
		this.#offscreen(draw, () => opacity);
	}

	/**
	 * Draws `draw`'s calls offscreen and composites each pixel scaled by the paint's alpha
	 * there; a radial gradient to transparent fades the group out from its centre.
	 */
	mask(paint: Raster.Paint, draw: () => void): void {
		let shader = compilePaint(paint);
		let pixel = this.#pixel;
		this.#offscreen(draw, (x, y) => {
			sample(shader, x, y, pixel);
			return pixel[3] ?? 0;
		});
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
				let originX =
					align === "center"
						? options.x - layout.width / 2
						: align === "end"
							? options.x - layout.width
							: options.x;
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
		let source = this.#stack[0] ?? new Float32Array(0);
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

	/** Composites one sampled paint pixel onto the current layer at `coverage`. */
	#blend(shader: Shader, x: number, y: number, coverage: number): void {
		let target = this.#stack.at(-1);
		if (!target) return;
		let pixel = this.#pixel;
		sample(shader, x, y, pixel);
		let offset = (y * this.width + x) * 4;
		let alpha = (pixel[3] ?? 0) * coverage;
		let keep = 1 - alpha;
		target[offset] = (pixel[0] ?? 0) * coverage + (target[offset] ?? 0) * keep;
		target[offset + 1] = (pixel[1] ?? 0) * coverage + (target[offset + 1] ?? 0) * keep;
		target[offset + 2] = (pixel[2] ?? 0) * coverage + (target[offset + 2] ?? 0) * keep;
		target[offset + 3] = alpha + (target[offset + 3] ?? 0) * keep;
	}

	/**
	 * Runs `draw` on a fresh transparent layer, then composites it onto the layer beneath,
	 * scaling each pixel by `factor(x, y)`. The layer is popped even when `draw` throws.
	 */
	#offscreen(draw: () => void, factor: (x: number, y: number) => number): void {
		let layer = new Float32Array(this.width * this.height * 4);
		this.#stack.push(layer);
		try {
			draw();
		} finally {
			this.#stack.pop();
		}
		let target = this.#stack.at(-1);
		if (!target) return;
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				let offset = (y * this.width + x) * 4;
				let layerAlpha = layer[offset + 3] ?? 0;
				if (layerAlpha <= 0) continue;
				let scale = factor(x, y);
				if (scale <= 0) continue;
				let keep = 1 - layerAlpha * scale;
				for (let channel = 0; channel < 4; channel++) {
					target[offset + channel] =
						(layer[offset + channel] ?? 0) * scale + (target[offset + channel] ?? 0) * keep;
				}
			}
		}
	}
}
