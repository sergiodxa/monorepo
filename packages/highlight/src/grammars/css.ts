/**
 * The CSS grammar: selectors and at-rules outside a declaration block, property
 * names and values inside one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer";

/** Tried before the `/` that opens it can read as a separator. */
const comment: Rule = { type: "comment", match: /\/\*(?:[^*]|\*(?!\/))*(?:\*\/)?/y };

/**
 * Both quotes, each ending at its own line: a fence cut mid-value still paints
 * the rest of itself as CSS rather than as one long string.
 */
const string: Rule[] = [
	{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },
	{ type: "string", match: /'(?:\\[\s\S]|[^'\\\n])*'?/y },
];

/** A number and the unit stuck to it, which a reader sees as one value. */
const number: Rule = {
	type: "number",
	match: /[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:%|[A-Za-z]+)?/y,
};

/**
 * The pieces a selector is spelled with, each painted on its own. A list's
 * commas and combinators coming out as punctuation is what keeps a selector
 * written across several lines legible.
 */
const selector: Rule[] = [
	{ type: "tag", match: /[&*]/y },
	{ type: "tag", match: /[.#][\w-]+/y },
	{ type: "tag", match: /::?[\w-]+/y },
	/** An attribute selector belongs to the selector, quoted value and all. */
	{ type: "tag", match: /\[[^\]\n]*\]?/y },
	{ type: "tag", match: /[A-Za-z][\w-]*/y },
	{ type: "punctuation", match: /[,>+~()]/y },
];

/**
 * What every selector context shares: an at-rule, and the braces that move
 * between selectors and declarations.
 */
const ruleset: Rule[] = [
	comment,
	{ type: "keyword", match: /@[\w-]+/y, push: "atrule" },
	{ type: "punctuation", match: /\{/y, push: "block" },
	{ type: "punctuation", match: /\}/y, pop: true },
	{ type: "punctuation", match: /;/y },
];

/**
 * A custom property being declared. The `--` says so on its own, which is why
 * this holds wherever a declaration can appear.
 */
const custom: Rule = { type: "property", match: /--[\w-]+(?=\s*:)/y, push: "value" };

/**
 * Highlights CSS, including nested rule sets, at-rule preludes, and the custom
 * properties a stylesheet declares and reads back.
 *
 * @example scan(".a { color: red }", css)
 */
export const css: Grammar = {
	/**
	 * Outside every block, where a word is a selector unless the colon after it
	 * opens a value that a `;`, a `}` or the end of the fence closes — which is
	 * what keeps `a:hover` a selector and a lone `color: red` a declaration.
	 */
	main: [
		...ruleset,
		custom,
		{
			type: "property",
			match: /[A-Za-z-][\w-]*(?=\s*:[^{}]*(?:[;}]|$))/y,
			push: "value",
		},
		...selector,
	],

	/**
	 * Inside `{ … }`, where a word followed by a colon is a property name. A
	 * nested rule set is reached through the `&` its selector starts with.
	 */
	block: [
		...ruleset,
		custom,
		{ type: "property", match: /[A-Za-z-][\w-]*(?=\s*:)/y, push: "value" },
		...selector,
	],

	/**
	 * A declaration's value, entered on its property name so the colon between
	 * them is punctuation rather than the start of a pseudo-class.
	 */
	value: [
		comment,
		{ type: "punctuation", match: /;/y, pop: true },
		/** A declaration list closed without a final semicolon. */
		{ type: "punctuation", match: /\}/y, pop: true },
		...string,
		{ type: "keyword", match: /!\s*important\b/iy },
		/** The custom property a `var()` reads, named the same way it was declared. */
		{ type: "property", match: /--[\w-]+/y },
		{ type: "function", match: /[\w-]+(?=\()/y },
		{ type: "number", match: /#[\da-fA-F]{3,8}\b/y },
		number,
		/** A keyword arrives whole, so the digits inside `preserve-3d` stay part of it. */
		{ type: "plain", match: /[A-Za-z][\w-]*/y },
		{ type: "operator", match: /[*+]|(?<=\s)[/-](?=\s)/y },
		{ type: "punctuation", match: /[()[\],:]/y },
	],

	/**
	 * An at-rule's prelude: the query, the layer names, or the URL between the
	 * `@word` and whatever ends it.
	 */
	atrule: [
		comment,
		{ type: "punctuation", match: /;/y, pop: true },
		/**
		 * The body an at-rule opens holds what its surroundings hold — rule sets at
		 * the top level, declarations inside a block — so the brace hands scanning
		 * back to the context the at-rule was written in.
		 */
		{ type: "punctuation", match: /\{/y, pop: true },
		...string,
		{ type: "property", match: /--[\w-]+/y },
		{ type: "property", match: /[A-Za-z-][\w-]*(?=\s*:)/y },
		{ type: "function", match: /[\w-]+(?=\()/y },
		{ type: "keyword", match: /\b(?:and|not|only|or)\b/y },
		number,
		/** A media type, a layer name, a supports value: named, and nothing more. */
		{ type: "plain", match: /[A-Za-z][\w-]*/y },
		{ type: "operator", match: /[<>]=?|=/y },
		{ type: "punctuation", match: /[(),:]/y },
	],
};
