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
 * Beyond the per-pixel primitives it exposes a few whole-grid operations the
 * editor's higher-level tools build on: {@link PixelGrid.floodFill} recolors a
 * 4-connected same-color region (the fill bucket), {@link PixelGrid.snapshot} /
 * {@link PixelGrid.restore} capture and re-apply the full state for undo/redo,
 * and {@link PixelGrid.loadPixels} adopts a decoded RGBA buffer wholesale (PNG
 * import). All stay pure and canvas-free.
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
 * An immutable snapshot of a grid's full state: its dimensions plus a copy of the
 * flat RGBA buffer. Produced by {@link PixelGrid.snapshot} and consumed by
 * {@link PixelGrid.restore}; the undo/redo history is a bounded stack of these so
 * a step can restore both the size and the pixels regardless of intervening
 * resizes. Kept a plain data record (no methods) so it is trivially copyable and
 * testable.
 */
export interface GridSnapshot {
	/** Grid width the snapshot was taken at. */
	width: number;
	/** Grid height the snapshot was taken at. */
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
	 * Replaces the entire grid with a previously captured {@link GridSnapshot},
	 * adopting its dimensions and a fresh copy of its buffer. Lets an undo/redo
	 * step restore both the size and the pixels in one operation. A snapshot whose
	 * buffer length does not match its declared dimensions is rejected.
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
	 * Replaces the grid contents with a decoded RGBA buffer, resizing the grid to
	 * the given dimensions to match. Used when importing an existing PNG so the
	 * editor adopts the file's size and pixels wholesale. The buffer is copied in,
	 * so the caller's array is not aliased.
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
	 * Flood-fills the contiguous region of pixels matching the color under
	 * `(x, y)` with `color`, using 4-connected neighbours (up/down/left/right).
	 * The seed pixel's RGBA is the target: only pixels sharing all four channels
	 * with it are recolored, so filling a transparent region paints the hole and
	 * filling a solid region repaints just that shape. A no-op when the seed is
	 * out of bounds or the target already equals the fill color (same RGB with an
	 * opaque seed), which also prevents an infinite revisit.
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
		// Nothing to do when the seed already holds the exact fill color; also
		// guards the search from never terminating on an already-filled region.
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
