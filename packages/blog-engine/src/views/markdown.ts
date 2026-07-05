import Markdoc from "@markdoc/markdoc";
import { Markdown } from "@pkg/markdown-server";
import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";

import { escape } from "./html";

/**
 * Parses post markdown through `@pkg/markdown-server` (prism-highlighted fences,
 * per the repo rule) and renders the resulting Markdoc tree to an HTML string for
 * SSR embedding. Post bodies carry no frontmatter, so a permissive schema is used.
 */
const parser = new Markdown({ frontmatter: s.object({}) });

/**
 * Renders markdown source to a trusted HTML string. Malformed input falls back to
 * an escaped `<pre>` so rendering never throws on bad content.
 * @param raw - Markdown source.
 * @returns HTML string safe to embed in a page.
 */
export function renderMarkdown(raw: string): string {
	if (!raw.trim()) return "";
	let result = parser.parse(raw);
	if (isFailure(result)) return `<pre>${escape(raw)}</pre>`;
	return Markdoc.renderers.html(result.data.content);
}
