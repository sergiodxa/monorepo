/**
 * Plain-text extraction from markdown, implemented as a walk over the parsed
 * AST instead of a pass of regular expressions over the source. Walking the
 * tree is what makes reference definitions, link titles, and fenced code
 * disappear cleanly, since the parser has already told us what each node is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Node } from "@markdoc/markdoc";

import { parse } from "@markdoc/markdoc";

/**
 * Tag syntax written literally in the source. Markdown parsers surface raw HTML
 * as text rather than as nodes, so the tags are removed from text content while
 * the words between them are kept.
 */
const HTML_TAG = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;

/**
 * An HTML comment, which renders as nothing and so contributes nothing to plain
 * text. Like tag syntax, it reaches the walk as literal text.
 */
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/** Options for {@link toPlainText}. */
export interface PlainTextOptions {
	/**
	 * Include the body of fenced and indented code blocks. Defaults to `false`,
	 * because source code reads as noise in an excerpt. Inline code is always
	 * kept, since it is part of the sentence around it.
	 */
	fences?: boolean;
	/** Include image alternative text. Defaults to `false`. */
	images?: boolean;
}

/** The options after defaults are applied, passed down through the walk. */
interface ResolvedOptions {
	fences: boolean;
	images: boolean;
}

/**
 * Concatenates the text of an inline subtree. Link and emphasis wrappers
 * contribute their children only, so a link's label survives while its href and
 * title do not, and a Markdoc tag contributes its content without its syntax.
 */
function inlineText(node: Node, options: ResolvedOptions): string {
	switch (node.type) {
		case "text":
			return String(node.attributes.content ?? "")
				.replace(HTML_COMMENT, "")
				.replace(HTML_TAG, "");
		case "code":
			return String(node.attributes.content ?? "");
		case "image":
			return options.images ? String(node.attributes.alt ?? "") : "";
		case "softbreak":
		case "hardbreak":
			return " ";
		case "comment":
			return "";
		case "tr":
			return childrenText(node, options, " ");
		default:
			return childrenText(node, options, "");
	}
}

/** Joins the inline text of a node's children with the given separator. */
function childrenText(node: Node, options: ResolvedOptions, separator: string): string {
	let parts: string[] = [];

	for (let child of node.children) {
		let text = inlineText(child, options);
		if (text.length > 0) parts.push(text);
	}

	return parts.join(separator);
}

/**
 * Walks a block node, appending one entry per block of prose. Each
 * text-bearing block wraps its content in an `inline` node, marking where a
 * block ends; a table row's cells combine into a single block.
 */
function collectBlocks(node: Node, options: ResolvedOptions, blocks: string[]): void {
	switch (node.type) {
		case "inline":
		case "tr": {
			let text = inlineText(node, options).trim();
			if (text.length > 0) blocks.push(text);
			return;
		}

		case "fence": {
			if (!options.fences) return;
			let content = String(node.attributes.content ?? "").trim();
			if (content.length > 0) blocks.push(content);
			return;
		}

		case "hr":
		case "comment":
		case "error":
			return;

		default: {
			for (let child of node.children) collectBlocks(child, options, blocks);
			for (let slot of Object.values(node.slots)) collectBlocks(slot, options, blocks);
			return;
		}
	}
}

/**
 * Extracts the prose from a markdown document, dropping frontmatter,
 * reference definitions, link targets, and raw HTML tags along with their
 * syntax, and keeping block boundaries so callers can compose their own summary.
 *
 * @param markdown - Markdown source, with or without frontmatter
 * @param options - Whether to include code blocks and image alternative text
 * @returns The document's prose, blocks separated by a blank line
 * @example toPlainText("# Hi\n\nA [link](https://example.com).") // "Hi\n\nA link."
 */
export function toPlainText(markdown: string, options: PlainTextOptions = {}): string {
	let resolved: ResolvedOptions = {
		fences: options.fences ?? false,
		images: options.images ?? false,
	};

	let blocks: string[] = [];
	collectBlocks(parse(markdown), resolved, blocks);

	return blocks.join("\n\n");
}
