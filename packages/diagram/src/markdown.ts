/**
 * The walk visitor for diagrams in markdown: a ```mermaid fence becomes a
 * `diagram` tag carrying its source, which the HTML tag renderer here and the
 * component in `./ui` draw as SVG.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";
import type { HTMLTagRenderer } from "@sdxc/markdown/html";

import { escapeText } from "./lib/serialize.js";

import { parseDiagram, toSVG } from "./index.js";

/** Options for {@link createDiagramVisitor}. */
export interface DiagramVisitorOptions {
	/**
	 * What happens to a diagram that does not parse: `fail` ends the walk with
	 * the parse's error, so a build catches a broken diagram; `keep` leaves the
	 * code block as the author wrote it.
	 *
	 * @default "fail"
	 */
	invalid?: "fail" | "keep";
}

/**
 * Builds the visitor. Its one handler is synchronous, so a walk with it
 * answers with a `Result` rather than a promise.
 *
 * @param options - What to do with a diagram that does not parse
 * @returns A visitor for `Markdown.walk`
 * @example Markdown.walk(document, createDiagramVisitor({ invalid: "keep" }))
 */
export function createDiagramVisitor(options: DiagramVisitorOptions = {}) {
	let keep = options.invalid === "keep";

	return {
		code(node: Markdown.Code): Markdown.Code | Markdown.Tag {
			if (node.language !== "mermaid") return node;
			let source = node.content.replace(/\n$/, "");
			let result = parseDiagram(source);
			if (result.status === "failure") {
				if (keep) return node;
				throw result.error;
			}
			return {
				type: "tag",
				name: "diagram",
				attributes: { source },
				children: [],
				position: node.position,
			};
		},
	} satisfies Markdown.Visitor;
}

/**
 * Walk a document with this to turn its ```mermaid fences into `diagram` tags.
 * A diagram that does not parse fails the walk, naming the diagram's own line
 * and column.
 *
 * @example Markdown.walk(document, diagram)
 */
export const diagram = createDiagramVisitor();

/**
 * Renders a `diagram` tag for `toHTML`'s `tags` option. A tag whose source does
 * not parse — one built by hand, or walked with `invalid: "keep"` elsewhere —
 * renders as its escaped source in a code block.
 *
 * @example toHTML(document, { tags: { diagram: renderDiagram } })
 */
export const renderDiagram: HTMLTagRenderer = (tag) => {
	let source = typeof tag.attributes.source === "string" ? tag.attributes.source : "";
	let result = toSVG(source);
	if (result.status === "success") return result.data;
	return `<pre><code class="language-mermaid">${escapeText(source)}</code></pre>`;
};
