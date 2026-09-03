/**
 * The JSX grammar: element syntax layered over the JavaScript rules, as the
 * modes an element is made of — its attribute list, and its children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer.js";

import { compose } from "../lexer.js";

import { javascript } from "./javascript.js";

/**
 * A `<` opens an element where a value can start — at the beginning of a line,
 * after an opening bracket, a comma, an operator, or `return` — and only when a
 * tag name and the character that ends it follow. Against a name it compares.
 */
const OPEN = /(?<=(?:^|[\n([{,;:=?>&|]|\breturn)[^\S\n]*)<(?=[A-Za-z][\w$.:-]*[\s>/{])/y;

/**
 * Between tags every `<` opens one, so an inline `<em>` is recognized right
 * after a word of text.
 */
const CHILD = /<(?=[A-Za-z][\w$.:-]*[\s>/{])/y;

/**
 * The rule an expression container is entered by, shared by the two places one
 * appears: an attribute's value, and an element's children.
 */
const CONTAINER: Rule = { type: "punctuation", match: /\{/y, push: "interpolation" };

/**
 * How an element starts where code is being read, which is both at the top
 * level and inside an expression container.
 */
const openers: Rule[] = [
	{ type: "punctuation", match: /<>/y, push: "children" },
	{ type: "punctuation", match: OPEN, push: "attributes" },
];

/**
 * The modes an element is made of, which {@link jsx} merges over the JavaScript
 * rules and TSX over the TypeScript ones: a `<` pushes `attributes`, the `>`
 * ending the opening tag pushes `children`, and a closing `</name>` pops both.
 */
export const elements: Grammar = {
	main: openers,
	interpolation: openers,

	/**
	 * Inside an opening tag, or inside the closing one a child popped back into.
	 */
	attributes: [
		{ type: "tag", match: /(?<=<\/?)[A-Za-z][\w$.:-]*/y },

		/** The `>` of a closing tag, which is where the whole element ends. */
		{ type: "punctuation", match: /(?<=<\/[A-Za-z][\w$.:-]*)[^\S\n]*>/y, pop: true },

		{ type: "punctuation", match: /\/>/y, pop: true },
		{ type: "punctuation", match: />/y, push: "children" },

		CONTAINER,
		{ type: "punctuation", match: /=/y },

		{ type: "attr-value", match: /"[^"\n]*"?/y },
		{ type: "attr-value", match: /'[^'\n]*'?/y },
		{ type: "attr-name", match: /[A-Za-z_$][\w$-]*(?::[\w$-]+)?/y },
	],

	/**
	 * Between an element's tags, where the only things a rule claims are a nested
	 * element and an expression container: text stays plain.
	 */
	children: [
		{ type: "punctuation", match: /<\/>/y, pop: true },
		{ type: "punctuation", match: /<\/(?=[A-Za-z])/y, pop: true },
		{ type: "punctuation", match: /<>/y, push: "children" },
		{ type: "punctuation", match: CHILD, push: "attributes" },
		CONTAINER,
	],
};

/**
 * Highlights JSX: every JavaScript construct, plus tags, their attributes, and
 * the expressions written inside `{…}`.
 *
 * @example scan("<a href={url}>{label}</a>", jsx)
 */
export const jsx: Grammar = compose(elements, javascript);
