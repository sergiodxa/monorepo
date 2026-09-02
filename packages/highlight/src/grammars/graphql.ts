/**
 * The GraphQL grammar, covering both halves of the language: the documents a
 * client sends and the schema a server publishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer";

/**
 * The words that introduce an operation or a type definition, plus `null`,
 * which is a literal spelled as a word.
 */
const KEYWORDS =
	/\b(?:directive|enum|extend|fragment|implements|input|interface|mutation|null|on|query|repeatable|scalar|schema|subscription|type|union)\b/y;

/**
 * The rules that read the same in a document body and inside an argument list.
 * A block string comes before the quote that would end a short one.
 */
const values: Rule[] = [
	{ type: "comment", match: /#[^\n]*/y },

	{ type: "string", match: /"""[\s\S]*?(?:"""|$)/y },
	{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },

	{ type: "variable", match: /\$[A-Za-z_]\w*/y },

	/** A directive applied to something, as opposed to the word that declares one. */
	{ type: "keyword", match: /@[A-Za-z_]\w*/y },

	{ type: "number", match: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
	{ type: "boolean", match: /\b(?:true|false)\b/y },
];

/**
 * The rules that close out a mode: the words, then the type names, then the
 * marks. `!` and the brackets around a list are type modifiers rather than
 * structure, which is why they read as operators.
 */
const names: Rule[] = [
	{ type: "keyword", match: KEYWORDS },
	{ type: "class-name", match: /\b[A-Z]\w*/y },
	{ type: "operator", match: /\.{3}|[!&|=[\]]/y },
	{ type: "punctuation", match: /[{}:,]/y },
];

/**
 * Highlights GraphQL, telling a field apart from an argument by where it sits:
 * inside a parenthesized list, a name before a colon is an argument.
 *
 * @example scan("query { user(id: 1) { name } }", graphql)
 */
export const graphql: Grammar = {
	main: [
		...values,

		/** A name before a colon is a field, whether it declares one or aliases one. */
		{ type: "property", match: /\b[a-z_]\w*(?=\s*:)/y },

		...names,
		{ type: "punctuation", match: /\(/y, push: "arguments" },

		/** Everything else lowercase in a document body is a field being selected. */
		{ type: "property", match: /\b[a-z_]\w*/y },
	],

	/**
	 * Inside `(…)`: an argument list, a field definition's parameters, or an
	 * operation's variable definitions. All three name their entries the same way.
	 */
	arguments: [
		{ type: "punctuation", match: /\)/y, pop: true },

		...values,
		{ type: "attr-name", match: /\b[a-z_]\w*(?=\s*:)/y },

		...names,
		{ type: "punctuation", match: /\(/y, push: "arguments" },
	],
};
