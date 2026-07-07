/**
 * Pure pixel-grid model for the sprite editor. Holds a fixed width×height buffer
 * of RGBA pixels (one `Uint8ClampedArray`, four bytes per pixel) with no DOM or
 * canvas dependency so it can be unit-tested in isolation. The {@link SpriteEditor}
 * wraps an instance of this class for its actual drawing surface: the editor
 * translates pointer input into `set`/`clear` calls and reads the buffer back out
 * to paint the canvas, while this model owns the source of truth for the sprite.
 *
 * Every pixel defaults to fully transparent (all four channels zero). Coordinates
 * are integer column/row pairs; out-of-bounds access is ignored on write and
 * treated as transparent on read so callers never have to bounds-check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Number of bytes per pixel in the RGBA buffer (red, green, blue, alpha). */
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
 * {@link MAX_DIMENSION}, throwing otherwise. Used by the constructor and
 * {@link PixelGrid.resize} so an invalid size fails loudly instead of allocating
 * a nonsensical buffer.
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
 * A pure, canvas-free grid of RGBA pixels. Owns a single flat byte buffer and
 * exposes get/set/clear/resize/serialize operations; the sprite editor wraps it
 * and mirrors its contents onto a canvas.
 */
export class PixelGrid {
	/** Grid width in pixels (columns). */
	#width: number;

	/** Grid height in pixels (rows). */
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
	 * Returns whether a column/row pair falls inside the grid bounds.
	 *
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
	 * transparent so callers never need to bounds-check before reading.
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
	 * Returns a copy of the flat RGBA buffer, row-major, four bytes per pixel. A
	 * copy (not the live buffer) is returned so callers cannot mutate the grid
	 * through the result — this is the native-resolution pixel data an offscreen
	 * canvas is painted from before PNG encoding.
	 *
	 * @returns A fresh `Uint8ClampedArray` of length `width * height * 4`.
	 */
	serialize(): Uint8ClampedArray {
		return new Uint8ClampedArray(this.#data);
	}
}
