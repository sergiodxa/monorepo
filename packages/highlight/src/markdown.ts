/**
 * The walk visitor for markdown code blocks: it resolves the language a block
 * names, tokenizes the body, and attaches the runs to the node it hands back,
 * along with the declaration of the field they arrive on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";

import type { Token } from "./lexer.js";

import { normalizeLanguage, tokenize } from "./index.js";

declare module "@sdxc/markdown" {
	namespace Markdown {
		interface Code {
			/** Painted onto the node rather than read from the source, so writing the document back drops it. */
			tokens?: Token[];
		}
	}
}

/**
 * Walk a document with this to paint every code block it holds. A block that
 * names no language is painted as plain, and every block keeps its `content`,
 * so a painted document still writes back as the markdown it came from.
 *
 * @example Markdown.walk(document, highlight)
 */
export const highlight = {
	code(node) {
		let language = normalizeLanguage(node.language ?? "plain");
		return { ...node, language, tokens: tokenize(node.content, language) };
	},
} satisfies Markdown.Visitor;
