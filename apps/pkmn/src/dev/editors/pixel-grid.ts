/**
 * Pure pixel-grid model backing the sprite editor: a fixed width×height RGBA
 * buffer, four bytes per pixel, that owns the sprite's source of truth and stays
 * testable on its own. Pixels start fully transparent, and out-of-bounds
 * coordinates are ignored on write and read as transparent, so any coordinate is
 * safe to pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const BYTES_PER_PIXEL = 4;

/** Largest grid dimension the model accepts, matching the editor's custom cap. */
export const MAX_DIMENSION = 128;

/** An opaque RGB color with each channel in the `0..=255` range. */
export interface Rgb {
	r: number;
	g: number;
	b: number;
}

/** A single grid pixel as RGBA channels, each in the `0..=255` range. */
export interface Rgba extends Rgb {
	a: number;
}

/**
 * A grid's dimensions plus a copy of its RGBA buffer, stacked by the undo/redo
 * history so a step restores both the size and the pixels regardless of
 * intervening resizes.
 */
export interface GridSnapshot {
	width: number;
	height: number;
	/** A copy of the flat RGBA buffer, row-major, four bytes per pixel. */
	data: Uint8ClampedArray;
}

/**
 * Clamps and rounds an arbitrary number into a valid `0..=255` byte channel so a
 * caller-supplied color can never write an out-of-range value into the buffer.
 *
 * @param value The raw channel value to normalize.
 * @returns An integer in the `0..=255` range.
 */
function toByte(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (value < 0) return 0;
	if (value > 255) return 255;
	return Math.round(value);
}

/**
 * Validates that a dimension is a positive integer no larger than
 * {@link MAX_DIMENSION}, so an invalid size fails loudly instead of allocating a
 * nonsensical buffer.
 *
 * @param label Which dimension is being checked, for the error message.
 * @param value The candidate dimension.
 * @returns The validated dimension unchanged.
 */
function assertDimension(label: string, value: number): number {
	if (!Number.isInteger(value) || value < 1 || value > MAX_DIMENSION) {
		throw new RangeError(
			`Invalid ${label}: ${value} (must be an integer in 1..=${MAX_DIMENSION}).`,
		);
	}
	return value;
}

/**
 * A pure grid of RGBA pixels over a single flat byte buffer, exposing
 * get/set/clear/resize/serialize operations; the sprite editor wraps it and
 * mirrors its contents onto a canvas.
 */
export class PixelGrid {
	#width: number;

	#height: number;

	/** Flat RGBA buffer, row-major, four bytes per pixel. */
	#data: Uint8ClampedArray;

	/**
	 * @param width Initial width in pixels (1..={@link MAX_DIMENSION}).
	 * @param height Initial height in pixels (1..={@link MAX_DIMENSION}).
	 */
	constructor(width: number, height: number) {
		this.#width = assertDimension("width", width);
		this.#height = assertDimension("height", height);
		this.#data = new Uint8ClampedArray(this.#width * this.#height * BYTES_PER_PIXEL);
	}

	/** Grid width in pixels. */
	get width(): number {
		return this.#width;
	}

	/** Grid height in pixels. */
	get height(): number {
		return this.#height;
	}

	/**
	 * @param x Column index.
	 * @param y Row index.
	 * @returns `true` when the coordinate is a paintable pixel.
	 */
	inBounds(x: number, y: number): boolean {
		return (
			Number.isInteger(x) &&
			Number.isInteger(y) &&
			x >= 0 &&
			y >= 0 &&
			x < this.#width &&
			y < this.#height
		);
	}

	/**
	 * Reads the RGBA value of a pixel. Out-of-bounds coordinates read as fully
	 * transparent, so any coordinate is safe to read.
	 *
	 * @param x Column index.
	 * @param y Row index.
	 * @returns The pixel's RGBA channels.
	 */
	get(x: number, y: number): Rgba {
		if (!this.inBounds(x, y)) return { r: 0, g: 0, b: 0, a: 0 };
		let offset = (y * this.#width + x) * BYTES_PER_PIXEL;
		return {
			r: this.#data[offset]!,
			g: this.#data[offset + 1]!,
			b: this.#data[offset + 2]!,
			a: this.#data[offset + 3]!,
		};
	}

	/**
	 * Paints a pixel to a fully-opaque RGB color. Out-of-bounds writes are
	 * silently ignored so drag painting past the edge is harmless.
	 *
	 * @param x Column index.
	 * @param y Row index.
	 * @param color The RGB color to write (alpha is forced to 255).
	 */
	set(x: number, y: number, color: Rgb): void {
		if (!this.inBounds(x, y)) return;
		let offset = (y * this.#width + x) * BYTES_PER_PIXEL;
		this.#data[offset] = toByte(color.r);
		this.#data[offset + 1] = toByte(color.g);
		this.#data[offset + 2] = toByte(color.b);
		this.#data[offset + 3] = 255;
	}

	/**
	 * Clears a single pixel back to fully transparent. Out-of-bounds coordinates
	 * are ignored.
	 *
	 * @param x Column index.
	 * @param y Row index.
	 */
	clearPixel(x: number, y: number): void {
		if (!this.inBounds(x, y)) return;
		let offset = (y * this.#width + x) * BYTES_PER_PIXEL;
		this.#data[offset] = 0;
		this.#data[offset + 1] = 0;
		this.#data[offset + 2] = 0;
		this.#data[offset + 3] = 0;
	}

	/** Clears every pixel back to fully transparent. */
	clear(): void {
		this.#data.fill(0);
	}

	/**
	 * Resizes the grid, preserving the overlapping top-left region and filling any
	 * newly exposed pixels with transparency. Pixels outside the new bounds are
	 * dropped. A no-op when the dimensions are unchanged.
	 *
	 * @param width New width in pixels (1..={@link MAX_DIMENSION}).
	 * @param height New height in pixels (1..={@link MAX_DIMENSION}).
	 */
	resize(width: number, height: number): void {
		let nextWidth = assertDimension("width", width);
		let nextHeight = assertDimension("height", height);
		if (nextWidth === this.#width && nextHeight === this.#height) return;

		let next = new Uint8ClampedArray(nextWidth * nextHeight * BYTES_PER_PIXEL);
		let copyWidth = Math.min(this.#width, nextWidth);
		let copyHeight = Math.min(this.#height, nextHeight);

		for (let y = 0; y < copyHeight; y++) {
			let sourceStart = y * this.#width * BYTES_PER_PIXEL;
			let sourceEnd = sourceStart + copyWidth * BYTES_PER_PIXEL;
			let targetStart = y * nextWidth * BYTES_PER_PIXEL;
			next.set(this.#data.subarray(sourceStart, sourceEnd), targetStart);
		}

		this.#width = nextWidth;
		this.#height = nextHeight;
		this.#data = next;
	}

	/**
	 * Returns a copy of the flat RGBA buffer, row-major, four bytes per pixel. The
	 * copy keeps the grid safe from callers mutating the result, and carries the
	 * native-resolution pixels an offscreen canvas is painted from for PNG export.
	 *
	 * @returns A fresh `Uint8ClampedArray` of length `width * height * 4`.
	 */
	serialize(): Uint8ClampedArray {
		return new Uint8ClampedArray(this.#data);
	}

	/**
	 * Captures a full snapshot of the grid — its dimensions plus a copy of the
	 * RGBA buffer — for the undo/redo history. The buffer is copied so later edits
	 * never mutate a stored step.
	 *
	 * @returns A {@link GridSnapshot} that can be handed back to {@link restore}.
	 */
	snapshot(): GridSnapshot {
		return {
			width: this.#width,
			height: this.#height,
			data: new Uint8ClampedArray(this.#data),
		};
	}

	/**
	 * Adopts a previously captured {@link GridSnapshot}'s dimensions and a fresh
	 * copy of its buffer, so an undo/redo step restores size and pixels in one
	 * operation. A buffer length matching the declared dimensions is required.
	 *
	 * @param snapshot The snapshot to restore into this grid.
	 */
	restore(snapshot: GridSnapshot): void {
		let width = assertDimension("width", snapshot.width);
		let height = assertDimension("height", snapshot.height);
		let expected = width * height * BYTES_PER_PIXEL;
		if (snapshot.data.length !== expected) {
			throw new RangeError(
				`Snapshot buffer length ${snapshot.data.length} does not match ${width}×${height} (${expected}).`,
			);
		}
		this.#width = width;
		this.#height = height;
		this.#data = new Uint8ClampedArray(snapshot.data);
	}

	/**
	 * Replaces the grid contents with a decoded RGBA buffer, resizing to the given
	 * dimensions, so importing a PNG adopts the file's size and pixels wholesale.
	 * The buffer is copied in, leaving the caller's array independent.
	 *
	 * @param width New width in pixels (1..={@link MAX_DIMENSION}).
	 * @param height New height in pixels (1..={@link MAX_DIMENSION}).
	 * @param pixels A row-major RGBA buffer of length `width * height * 4`.
	 */
	loadPixels(width: number, height: number, pixels: Uint8ClampedArray): void {
		let nextWidth = assertDimension("width", width);
		let nextHeight = assertDimension("height", height);
		let expected = nextWidth * nextHeight * BYTES_PER_PIXEL;
		if (pixels.length !== expected) {
			throw new RangeError(
				`Pixel buffer length ${pixels.length} does not match ${nextWidth}×${nextHeight} (${expected}).`,
			);
		}
		this.#width = nextWidth;
		this.#height = nextHeight;
		this.#data = new Uint8ClampedArray(pixels);
	}

	/**
	 * Recolors the 4-connected region whose RGBA matches the seed at `(x, y)`, so a
	 * transparent area fills as a hole and a solid shape repaints alone. A seed out
	 * of bounds or already the fill color returns 0, keeping the search finite.
	 *
	 * @param x Seed column index.
	 * @param y Seed row index.
	 * @param color The RGB color to paint the region (written fully opaque).
	 * @returns The number of pixels recolored.
	 */
	floodFill(x: number, y: number, color: Rgb): number {
		if (!this.inBounds(x, y)) return 0;

		let target = this.get(x, y);
		let fill: Rgba = { r: toByte(color.r), g: toByte(color.g), b: toByte(color.b), a: 255 };
		if (target.r === fill.r && target.g === fill.g && target.b === fill.b && target.a === fill.a) {
			return 0;
		}

		let filled = 0;
		let stack: Array<[number, number]> = [[x, y]];
		while (stack.length > 0) {
			let [cx, cy] = stack.pop()!;
			if (!this.inBounds(cx, cy)) continue;
			let pixel = this.get(cx, cy);
			if (
				pixel.r !== target.r ||
				pixel.g !== target.g ||
				pixel.b !== target.b ||
				pixel.a !== target.a
			) {
				continue;
			}
			this.set(cx, cy, fill);
			filled++;
			stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
		}
		return filled;
	}
}
