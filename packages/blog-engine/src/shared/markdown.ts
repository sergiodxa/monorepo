import { Markdown } from "@pkg/markdown-server";
import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";

/**
 * Shared markdown parser (prism-highlighted fences, per the repo rule). Post bodies
 * carry no frontmatter, so a permissive schema is used. The parsed Markdoc tree is
 * rendered to `remix/ui` nodes by `MarkdownView` from `@pkg/markdown/client/remix`.
 */
const parser = new Markdown({ frontmatter: s.object({}) });

/**
 * Parses markdown source into a Markdoc render tree, or `null` when empty/invalid.
 * @param raw - Markdown source.
 * @returns The parsed content tree, or `null`.
 */
export function parseMarkdown(raw: string): unknown | null {
	if (!raw.trim()) return null;
	let result = parser.parse(raw);
	if (isFailure(result)) return null;
	return result.data.content;
}
