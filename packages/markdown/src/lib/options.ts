/**
 * Turns the options a caller hands an entry point into the shape the parser
 * reads: tags keyed by name with their defaults applied, so the block and inline
 * phases both ask the same question and get the same answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import type { Markdown } from "../index.js";

import { MarkdownParseError } from "./errors.js";

/** One registered tag, after `content` has taken its default. */
export interface ResolvedTag {
	name: string;
	content: "blocks" | "inline" | "none";
	attributes?: StandardSchemaV1;
}

/** What both parsing phases read, with every default already applied. */
export interface ResolvedOptions {
	tags: Map<string, ResolvedTag>;
}

/**
 * Applies the defaults once, ahead of parsing, so a tag lookup during the walk
 * over lines is a map read rather than a fresh merge per occurrence.
 *
 * @param options - The options a caller passed to an entry point
 * @returns The same tags, keyed by name, with `content` defaulted to `"blocks"`
 */
export function resolveOptions(options: Markdown.Options): ResolvedOptions {
	let tags = new Map<string, ResolvedTag>();

	for (let [name, definition] of Object.entries(options.tags ?? {})) {
		tags.set(name, {
			name,
			content: definition.content ?? "blocks",
			attributes: definition.attributes,
		});
	}

	return { tags };
}

/**
 * Runs a tag's schema over its attributes and answers with the schema's output, so
 * a coercing schema hands the tree the values it produced. A schema answering with a
 * promise is refused, because a document reads synchronously.
 *
 * @param definition - The registered tag, schema included
 * @param attributes - The attributes the source wrote, variables filled in
 * @param position - The opening tag's span, which a failure is reported at
 * @returns The validated attributes, or a failure carrying the schema's issues
 */
export function validateTagAttributes(
	definition: Pick<ResolvedTag, "name" | "attributes">,
	attributes: Markdown.Attributes,
	position: Markdown.Position,
): Result<Markdown.Attributes, MarkdownParseError> {
	let schema = definition.attributes;
	if (!schema) return success(attributes);

	let result = schema["~standard"].validate(attributes);

	if (result instanceof Promise) {
		return failure(
			new MarkdownParseError(`The <${definition.name}> tag's attribute schema is asynchronous`, {
				position,
			}),
		);
	}

	if (result.issues) {
		return failure(
			new MarkdownParseError(`Invalid attributes for <${definition.name}>`, {
				position,
				issues: result.issues,
			}),
		);
	}

	return success(result.value as Markdown.Attributes);
}
