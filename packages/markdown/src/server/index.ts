import type { Config, RenderableTreeNodes } from "@markdoc/markdoc";
import type { Result } from "@pkg/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as Markdoc from "@markdoc/markdoc";
import { failure, isFailure, success } from "@pkg/result";
import YAML from "yaml";

import { fence } from "./fence.js";

export class MarkdownParseError extends Error {
	override name = "MarkdownParseError";
	issues: ReadonlyArray<StandardSchemaV1.Issue>;

	constructor(
		message: string,
		issues: ReadonlyArray<StandardSchemaV1.Issue> = [],
		options?: ErrorOptions,
	) {
		super(message, options);
		this.issues = issues;
	}
}

export namespace Markdown {
	export type AST = RenderableTreeNodes;

	export interface Parsed<FM> {
		content: AST;
		frontmatter: FM;
	}

	export interface Options<Schema extends StandardSchemaV1> {
		frontmatter: Schema;
		markdoc?: Config;
	}
}

export class Markdown<Schema extends StandardSchemaV1> {
	#options: Markdown.Options<Schema>;

	constructor(options: Markdown.Options<Schema>) {
		this.#options = options;
	}

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
