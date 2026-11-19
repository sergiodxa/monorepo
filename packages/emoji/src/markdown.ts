/**
 * A `Markdown.walk` visitor that turns `:shortcode:` tokens in `text` nodes
 * into Unicode characters or inline HTML images for customs, leaving code and
 * link text exactly as written so URLs and quoted names survive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";

import type { EmojiEntry, ShortcodeIndex } from "./lib/types.js";

import { indexEntries } from "./lib/index-entries.js";
import { segmentsToHTML, segmentsToText } from "./lib/render.js";
import { tokenize } from "./lib/tokenize.js";

/** How custom shortcodes are written back into the markdown AST. */
export interface EmojiMarkdownOptions {
	/**
	 * `text` keeps customs as `:name:` in the text node (Unicode still expands).
	 * `html` replaces a text node that holds any custom with an `inlineHtml` img.
	 *
	 * @default "text"
	 */
	custom?: "text" | "html";
}

/**
 * Builds a visitor over the given catalog or shortcode index.
 *
 * @param entriesOrIndex - Catalog rows or a prebuilt index
 * @param options - How to emit custom emoji
 * @returns A visitor for `Markdown.walk`
 * @example Markdown.walk(document, emojis(catalog))
 */
export function emojis(
	entriesOrIndex: readonly EmojiEntry[] | ShortcodeIndex,
	options: EmojiMarkdownOptions = {},
) {
	let index: ShortcodeIndex =
		entriesOrIndex instanceof Map
			? entriesOrIndex
			: indexEntries(entriesOrIndex as readonly EmojiEntry[]);
	let custom = options.custom ?? "text";
	let linked = new WeakSet<Markdown.Text>();

	return {
		/** Marks the link's text so the walk into its children leaves it as written. */
		link(node: Markdown.Link): undefined {
			markText(node.children, linked);
			return undefined;
		},
		/** Expands shortcodes and standalone emoticons outside links and code. */
		text(node: Markdown.Text): Markdown.Text | Markdown.InlineHtml | undefined {
			if (linked.has(node)) return undefined;
			let segments = tokenize(node.value, index);
			if (segments.length === 1 && segments[0]?.type === "text") return undefined;

			if (custom === "html" && segments.some((segment) => segment.type === "custom")) {
				let html: Markdown.InlineHtml = {
					type: "inlineHtml",
					value: segmentsToHTML(segments),
					position: node.position,
				};
				return html;
			}

			let value = segmentsToText(segments);
			if (value === node.value) return undefined;
			return { ...node, value };
		},
	} satisfies Markdown.Visitor;
}

/** Adds every text node under `nodes`, at any depth, to `into`. */
function markText(nodes: readonly Markdown.Inline[], into: WeakSet<Markdown.Text>): void {
	for (let node of nodes) {
		if (node.type === "text") into.add(node);
		else if ("children" in node && Array.isArray(node.children)) {
			markText(node.children as Markdown.Inline[], into);
		}
	}
}
