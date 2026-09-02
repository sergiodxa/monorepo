/**
 * The Markdoc node for fenced code blocks: it resolves the language written on
 * the fence, tokenizes the body, and emits a `Fence` tag carrying both for a
 * renderer to draw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "@markdoc/markdoc";

import { Tag } from "@markdoc/markdoc";
import * as s from "remix/data-schema";

import type { Token } from "./lexer";

import { normalizeLanguage, tokenize } from "./index";

const AttributesSchema = s.object({
	content: s.string(),
	language: s.defaulted(s.string(), "plain"),
	path: s.optional(s.string()),
	title: s.optional(s.string()),
});

/**
 * Groups the types a renderer needs to draw the tag this node emits.
 */
export namespace fence {
	/**
	 * What a `Fence` tag carries. Tokens rather than markup, so a renderer emits
	 * its own elements: styled spans on a page, inline-styled ones in an inbox.
	 */
	export interface Attributes {
		tokens: Token[];
		language: string;
		path?: string;
		title?: string;
	}
}

/**
 * Register as `nodes.fence` in a Markdoc config to highlight fenced code at
 * transform time, into a `Fence` tag your renderer draws.
 *
 * @example Markdoc.transform(ast, { nodes: { fence } })
 */
export const fence = {
	attributes: {
		language: { type: String, default: "plain" },
		path: { type: String },
		title: { type: String },
	},

	transform(node) {
		let parsed = s.parse(AttributesSchema, {
			content: node.children?.[0]?.attributes?.content ?? "",
			...node.attributes,
		});

		let language = normalizeLanguage(parsed.language);

		return new Tag("Fence", {
			tokens: tokenize(parsed.content, language),
			language,
			path: parsed.path,
			title: parsed.title,
		} satisfies fence.Attributes);
	},
} satisfies Schema;
