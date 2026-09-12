/**
 * Shared markdown parsing for post bodies: the {@link parseMarkdown} helper reads a
 * field's source into a document whose fences are already painted. Kept in one place
 * so every post type parses and highlights identically.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

/**
 * Parses markdown source into a document carrying the tokens a fence renders with.
 * Empty source, and source the parser stops on, both come back as `null`, so a
 * caller draws its own note in place of an article with nothing in it.
 *
 * @param raw - Markdown source.
 * @returns The parsed document, or `null`.
 */
export function parseMarkdown(raw: string): Markdown.Document | null {
	if (!raw.trim()) return null;

	let parsed = Markdown.parse(raw);
	if (isFailure(parsed)) return null;

	let highlighted = Markdown.walk(parsed.data.document, highlight);
	if (isFailure(highlighted)) return null;

	return highlighted.data;
}
