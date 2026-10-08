/**
 * The errors `EPUB.build` answers, one subclass per code, so checking `code` narrows the
 * error. Each names the chapter id or container path it concerns, which is what a caller
 * logs to find the input that would have made epubcheck reject the file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why `EPUB.build` produced no publication. Every failure is one of its subclasses, and
 * `instanceof EpubError` matches them all.
 */
export class EpubError extends Error {
	override name = "EpubError";

	/**
	 * @param code - Which rule the input broke
	 * @param message - A description for logs
	 * @param path - The chapter id or container path it concerns
	 * @param options - The parser's error, as `cause`, where one exists
	 */
	constructor(
		readonly code: EpubError.Code,
		message: string,
		readonly path?: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

/** The types {@link EpubError} carries. */
export namespace EpubError {
	/** One code per verification rule; the README lists what each covers. */
	export type Code =
		| "invalid-metadata"
		| "invalid-content"
		| "missing-resource"
		| "remote-resource"
		| "unsupported-media"
		| "invalid-path";
}

/** Required metadata is missing, `modified` is not a date, or a language tag is malformed. */
export class EpubMetadataError extends EpubError {
	declare readonly code: "invalid-metadata";

	/**
	 * @param message - Which field, for logs
	 * @param path - The metadata field or chapter id
	 */
	constructor(message: string, path?: string) {
		super("invalid-metadata", message, path);
	}
}

/**
 * A chapter body is not well-formed XML, or holds script, an event handler, a form, a
 * duplicate id or a character XML forbids; `cause` carries the parser's error.
 */
export class EpubContentError extends EpubError {
	declare readonly code: "invalid-content";

	/**
	 * @param message - What the body holds, for logs
	 * @param path - The chapter id
	 * @param options - The parser's error, as `cause`
	 */
	constructor(message: string, path?: string, options?: ErrorOptions) {
		super("invalid-content", message, path, options);
	}
}

/** A reference or table-of-contents fragment names a file or an `id` the publication lacks. */
export class EpubMissingResourceError extends EpubError {
	declare readonly code: "missing-resource";

	/**
	 * @param message - The reference, for logs
	 * @param path - The chapter id holding it
	 */
	constructor(message: string, path?: string) {
		super("missing-resource", message, path);
	}
}

/** An image, stylesheet, font or other embedded resource points at the web. */
export class EpubRemoteResourceError extends EpubError {
	declare readonly code: "remote-resource";

	/**
	 * @param message - The reference, for logs
	 * @param path - The chapter id holding it
	 */
	constructor(message: string, path?: string) {
		super("remote-resource", message, path);
	}
}

/** A resource's extension maps to no EPUB core media type. */
export class EpubMediaTypeError extends EpubError {
	declare readonly code: "unsupported-media";

	/**
	 * @param message - The extension, for logs
	 * @param path - The resource path
	 */
	constructor(message: string, path?: string) {
		super("unsupported-media", message, path);
	}
}

/** A path or id is malformed, reserved, or used twice. */
export class EpubPathError extends EpubError {
	declare readonly code: "invalid-path";

	/**
	 * @param message - The rule broken, for logs
	 * @param path - The path or id
	 */
	constructor(message: string, path?: string) {
		super("invalid-path", message, path);
	}
}
