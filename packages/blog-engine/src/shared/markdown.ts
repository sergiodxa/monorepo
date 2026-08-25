/**
 * Shared markdown parsing for post bodies: a single configured `@pkg/markdown/server`
 * parser and the {@link parseMarkdown} helper returning a Markdoc render tree (or
 * `null`). Kept in one place so every post type highlights and parses identically.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";

/**
 * Shared markdown parser (prism-highlighted fences, per the repo rule). Post bodies
 * carry no frontmatter, so a permissive schema is used.
 */
const parser = new Markdown({ frontmatter: s.object({}) });

/**
 * Parses markdown source into a Markdoc render tree, or `null` when empty or
 * invalid. The tree's shape stays opaque here since only the client-side renderer
 * interprets it, so the return type stays `unknown`, which already admits `null`.
 * @param raw - Markdown source.
 * @returns The parsed content tree, or `null`.
 */
export function parseMarkdown(raw: string): unknown {
	if (!raw.trim()) return null;
	let result = parser.parse(raw);
	if (isFailure(result)) return null;
	return result.data.content;
}
