/**
 * Lookups over the tags of a parsed comment, so a renderer asks for the tag it
 * wants instead of scanning the list and repeating the alias rules that
 * `parseComment` already applied.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocComment, DocTag } from "./types.js";

/**
 * Find the first tag with the given canonical name.
 *
 * @param comment - Comment to search, or `null` for a symbol without one.
 * @param tag - Canonical name without the `@`, such as `returns`.
 * @returns The matching tag, or `null` when the comment does not carry one.
 *
 * @example
 * findTag(comment, "returns")?.text;
 */
export function findTag(comment: DocComment | null, tag: string): DocTag | null {
	return comment?.tags.find((candidate) => candidate.tag === tag) ?? null;
}

/**
 * Collect every tag with the given canonical name, in source order.
 *
 * @param comment - Comment to search, or `null` for a symbol without one.
 * @param tag - Canonical name without the `@`, such as `example`.
 * @returns Each matching tag, empty when the comment carries none.
 *
 * @example
 * findTags(comment, "example").map((example) => example.text);
 */
export function findTags(comment: DocComment | null, tag: string): DocTag[] {
	return comment?.tags.filter((candidate) => candidate.tag === tag) ?? [];
}
