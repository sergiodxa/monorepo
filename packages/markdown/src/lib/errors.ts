/**
 * The three ways reading or writing a document fails. Each carries the position
 * it failed at, so a caller reports the line an author has to open rather than a
 * message about the document as a whole.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Markdown } from "../index.js";

/** Signals a document the parser or a schema rejected, naming where it gave up. */
export class MarkdownParseError extends Error {
	override name = "MarkdownParseError";

	/** Where in the source the document stopped making sense. */
	position?: Markdown.Position;

	/** Issues the frontmatter or a tag's attribute schema reported. */
	issues: ReadonlyArray<StandardSchemaV1.Issue>;

	/**
	 * @param message - What the parser could not read
	 * @param options - The position it stopped at, the issues a schema raised, and a cause
	 */
	constructor(
		message: string,
		options: ErrorOptions & {
			position?: Markdown.Position;
			issues?: ReadonlyArray<StandardSchemaV1.Issue>;
		} = {},
	) {
		super(message, options);
		this.position = options.position;
		this.issues = options.issues ?? [];
	}
}

/** Signals a document that cannot be written, which today means a frontmatter value YAML rejects. */
export class MarkdownStringifyError extends Error {
	override name = "MarkdownStringifyError";
}

/** Signals a visitor that threw or returned something the walk cannot splice in. */
export class MarkdownWalkError extends Error {
	override name = "MarkdownWalkError";

	/** The node the visitor was standing on, which is what a bare `throw` loses. */
	position?: Markdown.Position;

	/**
	 * @param message - What the walk could not do
	 * @param options - The visited node's position and the value the handler threw
	 */
	constructor(message: string, options: ErrorOptions & { position?: Markdown.Position } = {}) {
		super(message, options);
		this.position = options.position;
	}
}
