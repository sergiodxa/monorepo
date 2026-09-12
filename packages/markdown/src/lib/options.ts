/**
 * Turns the options a caller hands an entry point into the shape the parser
 * reads: tags keyed by name with their defaults applied, so the block and inline
 * phases both ask the same question and get the same answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Markdown } from "../index.js";

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
