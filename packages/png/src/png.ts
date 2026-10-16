/**
 * The shapes `encode` takes and `decode` returns, and the error every decode failure is
 * reported as. `PNG.Image` uses the layout of the web's `ImageData`, so a pixel buffer moves
 * between a canvas and this package without conversion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The types `encode` and `decode` exchange. */
export namespace PNG {
	/**
	 * A bitmap in straight (non-premultiplied) RGBA, 8 bits per channel, row-major with the
	 * top row first, so `data[(y * width + x) * 4 + 3]` is the alpha of pixel `(x, y)`.
	 */
	export interface Image {
		width: number;
		height: number;
		/** `width * height * 4` bytes. */
		data: Uint8ClampedArray;
	}

	/** How `encode` writes an image. */
	export interface EncodeOptions {
		/**
		 * `"auto"` drops the alpha channel (color type 2) when every pixel is opaque, which
		 * shrinks the file by a quarter before compression; `"keep"` always writes RGBA.
		 *
		 * @default "auto"
		 */
		alpha?: "auto" | "keep";
		/**
		 * Text written as one `tEXt` chunk per entry. Keywords are 1–79 Latin-1 characters;
		 * values are Latin-1.
		 *
		 * @example { Software: "My App", Title: "Social card" }
		 */
		text?: Record<string, string>;
	}
}

/**
 * Why `decode` refused a file. The `code` is stable, so a caller can branch on it and a log
 * can group by it; the message names the chunk or field involved.
 */
export class PNGError extends Error {
	override name = "PNGError";

	/**
	 * @param code - What went wrong
	 * @param message - A description for logs
	 * @param options - The underlying error, as `cause`
	 */
	constructor(
		readonly code: PNGError.Code,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

/** The types {@link PNGError} carries. */
export namespace PNGError {
	/**
	 * `signature` when the bytes do not start like a PNG; `crc` when a chunk's checksum
	 * disagrees with its contents; `header` for an `IHDR`, `PLTE` or chunk order the
	 * specification forbids; `unsupported` for an unknown critical chunk, filter or method, or
	 * an image too large to hold in memory; `truncated` when the file or its pixel data ends
	 * early; `inflate` when the compressed pixel data is corrupt.
	 */
	export type Code = "signature" | "crc" | "header" | "unsupported" | "truncated" | "inflate";
}
