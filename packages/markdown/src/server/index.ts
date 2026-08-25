/**
 * Server-only markdown parsing: Markdoc transformation plus frontmatter
 * validation against a Standard Schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Config, RenderableTreeNodes } from "@markdoc/markdoc";
import type { Result } from "@pkg/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as Markdoc from "@markdoc/markdoc";
import { failure, isFailure, success } from "@pkg/result";
import YAML from "yaml";

import { fence } from "./fence";

export { fence, normalizeLanguage } from "./fence";
export { toPlainText } from "./plain-text";
export type { PlainTextOptions } from "./plain-text";

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
				let yaml = raw.slice(4, end);
				content = raw.slice(end + 5);

				try {
					frontmatter = YAML.parse(yaml) ?? {};
				} catch {
					frontmatter = {};
				}
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
