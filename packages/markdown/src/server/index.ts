/**
 * Server-only markdown parsing: Markdoc transformation plus frontmatter
 * validation against a Standard Schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Config, RenderableTreeNodes } from "@markdoc/markdoc";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as Markdoc from "@markdoc/markdoc";
import { fence } from "@sdxc/highlight/markdoc";
import { failure, isFailure, success } from "@sdxc/result";
import { parse as parseYAML } from "@sdxc/yaml";

export { toPlainText } from "./plain-text.js";
export type { PlainTextOptions } from "./plain-text.js";

/**
 * Error returned when frontmatter fails to parse or validate.
 */
export class MarkdownParseError extends Error {
	/**
	 * Issues reported by the Standard Schema validator.
	 */
	issues: ReadonlyArray<StandardSchemaV1.Issue>;

	/**
	 * Creates a parse error with the validation issues that caused it.
	 *
	 * @param message - Human readable description of the failure
	 * @param issues - Validation issues returned by Standard Schema
	 * @param options - Native error options for chained causes
	 */
	constructor(
		message: string,
		issues: ReadonlyArray<StandardSchemaV1.Issue> = [],
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "MarkdownParseError";
		this.issues = issues;
	}
}

/**
 * Markdown parsing helpers shared by server-only consumers.
 */
export namespace Markdown {
	/**
	 * Parsed markdown content and validated frontmatter.
	 */
	export interface Parsed<FM> {
		content: RenderableTreeNodes;
		frontmatter: FM;
	}

	/**
	 * Configuration for a parser instance.
	 */
	export interface Options<Schema extends StandardSchemaV1> {
		frontmatter: Schema;
		markdoc?: Config;
	}
}

/**
 * Parses markdown source into Markdoc render tree and validated frontmatter.
 */
export class Markdown<Schema extends StandardSchemaV1> {
	#options: Markdown.Options<Schema>;

	/**
	 * Stores parser configuration for later reuse.
	 *
	 * @param options - Parser configuration
	 */
	constructor(options: Markdown.Options<Schema>) {
		this.#options = options;
	}

	/**
	 * Parses frontmatter and transforms markdown content into Markdoc output.
	 *
	 * @param raw - Markdown source
	 * @returns Validation result containing parsed content or a parse error
	 */
	parse(
		raw: string,
	): Result<Markdown.Parsed<StandardSchemaV1.InferOutput<Schema>>, MarkdownParseError> {
		let result = Markdown.frontmatter(raw, this.#options.frontmatter);
		if (isFailure(result)) return result;

		let config = {
			...this.#options.markdoc,
			nodes: { fence, ...this.#options.markdoc?.nodes },
		} satisfies Config;

		let ast = Markdoc.parse(result.data.content);
		let content = Markdoc.transform(ast, config);

		return success({ content, frontmatter: result.data.frontmatter });
	}

	/**
	 * Extracts validated frontmatter without transforming the markdown body.
	 *
	 * @param raw - Markdown source
	 * @param schema - Standard Schema validator for the frontmatter
	 * @returns Validation result containing frontmatter and remaining content
	 */
	static frontmatter<FM, Schema extends StandardSchemaV1>(
		raw: string,
		schema: Schema,
	): Result<{ frontmatter: FM; content: string }, MarkdownParseError> {
		let content = raw;
		let frontmatter: unknown = {};

		if (raw.startsWith("---\n")) {
			let end = raw.indexOf("\n---\n", 4);
			if (end !== -1) {
				content = raw.slice(end + 5);

				/**
				 * A block the parser cannot read stands in as empty rather than failing here,
				 * so the schema is what reports the document as invalid — and a body that
				 * merely opens on two thematic breaks still renders.
				 */
				let parsed = parseYAML(raw.slice(4, end));
				frontmatter = isFailure(parsed) ? {} : (parsed.data ?? {});
			}
		}

		let result = schema["~standard"].validate(frontmatter);
		if (result instanceof Promise) {
			return failure(new MarkdownParseError("Asynchronous schemas are not supported"));
		}

		if (result.issues) {
			return failure(new MarkdownParseError("Invalid markdown frontmatter", result.issues));
		}

		return success({ frontmatter: result.value as FM, content });
	}
}
