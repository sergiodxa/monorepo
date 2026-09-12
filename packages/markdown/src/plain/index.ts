/**
 * Plain text from a parsed document, for excerpts, word counts, and search
 * indexes. It takes the AST rather than a source string, so a caller that has
 * already parsed does not parse twice and measures what it actually renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/**
 * Node types that open a block of their own, which is what tells a tag wrapped
 * around paragraphs apart from one written inside a sentence.
 */
const BLOCK_TYPES: ReadonlySet<string> = new Set([
	"alert",
	"blockquote",
	"code",
	"document",
	"footnoteDefinition",
	"heading",
	"html",
	"list",
	"listItem",
	"paragraph",
	"table",
	"tableCell",
	"tableRow",
	"thematicBreak",
]);

/** Options for {@link toPlainText}. */
export interface PlainTextOptions {
	/**
	 * Include the body of code blocks. Inline code is always kept, since it is
	 * part of the sentence around it.
	 *
	 * @default false
	 */
	code?: boolean;
	/**
	 * Include an image's alternative text.
	 *
	 * @default false
	 */
	images?: boolean;
}

/** The options after defaults are applied, passed down through the walk. */
interface ResolvedOptions {
	code: boolean;
	images: boolean;
}

/**
 * Reads a node as part of a sentence, so a wrapper such as emphasis or a link
 * contributes its children alone and the words around it close back up over
 * whatever the options leave out.
 */
function inlineText(node: Markdown.Node, options: ResolvedOptions): string {
	switch (node.type) {
		case "text":
		case "inlineCode":
			return node.value;

		case "code":
			return options.code ? node.content : "";

		case "image":
			return options.images ? childrenText(node.children, options, "") : "";

		case "softBreak":
		case "hardBreak":
			return " ";

		case "html":
		case "inlineHtml":
		case "thematicBreak":
		case "footnoteReference":
		case "variable":
			return "";

		case "tableRow":
			return childrenText(node.children, options, " ");

		default:
			return childrenText(node.children, options, "");
	}
}

/** Joins the text of a node's children, keeping only the parts that carry prose. */
function childrenText(
	children: readonly Markdown.Node[],
	options: ResolvedOptions,
	separator: string,
): string {
	let parts: string[] = [];

	for (let child of children) {
		let text = inlineText(child, options);
		if (text.length > 0) parts.push(text);
	}

	return parts.join(separator);
}

/** Appends a block's prose once it holds something a reader would see. */
function push(blocks: string[], text: string): void {
	let trimmed = text.trim();
	if (trimmed.length > 0) blocks.push(trimmed);
}

/**
 * Walks a node for the blocks of prose under it, appending one entry per block
 * so the caller decides how a summary joins them. A table row arrives as a
 * single block, its cells spaced apart.
 */
function collectBlocks(node: Markdown.Node, options: ResolvedOptions, blocks: string[]): void {
	switch (node.type) {
		case "heading":
		case "paragraph":
		case "tableCell":
			push(blocks, childrenText(node.children, options, ""));
			return;

		case "tableRow":
			push(blocks, childrenText(node.children, options, " "));
			return;

		case "code":
			if (options.code) push(blocks, node.content);
			return;

		case "html":
		case "thematicBreak":
			return;

		case "document":
		case "blockquote":
		case "alert":
		case "list":
		case "listItem":
		case "table":
		case "footnoteDefinition": {
			for (let child of node.children) collectBlocks(child, options, blocks);
			return;
		}

		case "tag": {
			let children: Markdown.Node[] = node.children;
			if (children.some((child) => BLOCK_TYPES.has(child.type))) {
				for (let child of children) collectBlocks(child, options, blocks);
				return;
			}
			push(blocks, childrenText(children, options, ""));
			return;
		}

		default:
			push(blocks, inlineText(node, options));
			return;
	}
}

/**
 * Reads the prose out of any node, block boundaries kept as blank lines so a
 * caller composes its own summary.
 *
 * @param node - Any node, which is what makes this usable inside a visitor
 * @param options - Whether code blocks and image alternative text count as prose
 * @returns The node's prose, blocks separated by a blank line
 * @example toPlainText(document, { code: true })
 */
export function toPlainText(node: Markdown.Node, options: PlainTextOptions = {}): string {
	let resolved: ResolvedOptions = {
		code: options.code ?? false,
		images: options.images ?? false,
	};

	let blocks: string[] = [];
	collectBlocks(node, resolved, blocks);

	return blocks.join("\n\n");
}
