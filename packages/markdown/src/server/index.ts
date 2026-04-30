import type { Config, RenderableTreeNodes } from "@markdoc/markdoc";
import type { Result } from "@pkg/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as Markdoc from "@markdoc/markdoc";
import { failure, isFailure, success } from "@pkg/result";
import YAML from "yaml";

import { fence } from "./fence.js";

/**
 * Reports frontmatter parsing or validation failures.
 */
export class MarkdownParseError extends Error {
	/**
	 * Keeps the error name stable for callers that branch on parse failures.
	 */
	override name = "MarkdownParseError";

	/**
	 * Stores schema issues returned by the frontmatter validator.
	 */
	issues: ReadonlyArray<StandardSchemaV1.Issue>;

	/**
	 * Creates a markdown parse error with optional schema issues.
	 *
	 * @param message - Human-readable parse failure message
	 * @param issues - Schema issues collected during validation
	 * @param options - Nested error context
	 */
	constructor(
		message: string,
		issues: ReadonlyArray<StandardSchemaV1.Issue> = [],
		options?: ErrorOptions,
	) {
		super(message, options);
		this.issues = issues;
	}
}

/**
 * Groups markdown parser types under the package namespace.
 */
export namespace Markdown {
	/**
	 * Stores the transformed Markdoc tree produced from markdown content.
	 */
	export type AST = RenderableTreeNodes;

	/**
	 * Returns rendered content together with validated frontmatter data.
	 */
	export interface Parsed<FM> {
		content: AST;
		frontmatter: FM;
	}

	/**
	 * Configures frontmatter validation and optional Markdoc overrides.
	 */
	export interface Options<Schema extends StandardSchemaV1> {
		frontmatter: Schema;
		markdoc?: Config;
	}
}

/**
 * Parses markdown documents and validates YAML frontmatter with a standard schema.
 */
export class Markdown<Schema extends StandardSchemaV1> {
	#options: Markdown.Options<Schema>;

	/**
	 * Stores the schema and Markdoc configuration used for parse operations.
	 *
	 * @param options - Frontmatter schema and optional Markdoc overrides
	 */
	constructor(options: Markdown.Options<Schema>) {
		this.#options = options;
	}

	/**
	 * Parses one markdown document into rendered content and validated frontmatter.
	 *
	 * @param raw - Markdown source that may begin with YAML frontmatter
	 * @returns Rendered content or a parse error when validation fails
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
	 * Extracts YAML frontmatter and validates it against the provided schema.
	 *
	 * Missing or malformed frontmatter is validated as an empty object.
	 *
	 * @param raw - Markdown source that may include a frontmatter block
	 * @param schema - Standard schema used to validate the parsed frontmatter
	 * @returns Validated frontmatter plus the remaining markdown content
	 */
	static frontmatter<Schema extends StandardSchemaV1>(
		raw: string,
		schema: Schema,
	): Result<
		{ frontmatter: StandardSchemaV1.InferOutput<Schema>; content: string },
		MarkdownParseError
	> {
		let match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

		if (!match) {
			let result = Markdown.#validateFrontmatter({}, schema);
			if (isFailure(result)) return result;
			return success({ frontmatter: result.data, content: raw });
		}

		let frontmatterText = match[1];
		let content = match[2];

		if (frontmatterText === undefined || content === undefined) {
			let result = Markdown.#validateFrontmatter({}, schema);
			if (isFailure(result)) return result;
			return success({ frontmatter: result.data, content: raw });
		}

		let object: Record<string, unknown>;
		try {
			let parsed = YAML.parse(frontmatterText);
			object = typeof parsed === "object" && parsed !== null ? parsed : {};
		} catch {
			object = {};
		}

		let result = Markdown.#validateFrontmatter(object, schema);
		if (isFailure(result)) return result;
		return success({ frontmatter: result.data, content });
	}

	static #validateFrontmatter<Schema extends StandardSchemaV1>(
		raw: Record<string, unknown>,
		schema: Schema,
	): Result<StandardSchemaV1.InferOutput<Schema>, MarkdownParseError> {
		let result = schema["~standard"].validate(raw);

		if (result instanceof Promise) {
			return failure(
				new MarkdownParseError("Failed to validate frontmatter.", [
					{ message: "Async validation is not supported." },
				]),
			);
		}

		if (result.issues) {
			return failure(new MarkdownParseError("Failed to validate frontmatter.", result.issues));
		}

		return success(result.value);
	}
}
