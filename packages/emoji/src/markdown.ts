/**
 * A `Markdown.walk` visitor that turns `:shortcode:` tokens in `text` nodes
 * into Unicode characters or inline HTML images for customs, leaving code
 * alone the way typography does.
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

	return {
		text(node: Markdown.Text): Markdown.Text | Markdown.InlineHtml | undefined {
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
