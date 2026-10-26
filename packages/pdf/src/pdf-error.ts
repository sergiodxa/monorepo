/**
 * The failure `@sdxc/pdf` answers inside a `Result` when an input it was handed, a font file
 * or an image, cannot go into a document. Drawing never fails, so this is the only error the
 * package produces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a font or image was refused. The `code` is stable for a caller to branch on, and
 * `cause` carries the font or image reader's own error when there is one.
 */
export class PDFError extends Error {
	override name = "PDFError";

	/**
	 * @param code - What went wrong.
	 * @param message - A description for logs.
	 * @param options - The underlying error, as `cause`.
	 */
	constructor(
		readonly code: PDFError.Code,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

/** The types {@link PDFError} carries. */
export namespace PDFError {
	/**
	 * `invalid-font` when `@sdxc/font` cannot read the file; `restricted-font` when the font's
	 * license forbids embedding; `invalid-image` when a JPEG or PNG is corrupt or truncated;
	 * `unsupported-image` for bytes that are neither, or a variant no PDF filter reads.
	 */
	export type Code = "invalid-font" | "restricted-font" | "invalid-image" | "unsupported-image";
}
