/**
 * The Ruby grammar, including the expressions inside a `#{…}` interpolation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer";

/**
 * Reserved words, plus the literals spelled as words and the attribute macros:
 * `attr_accessor` is a method, but it reads as part of the language wherever a
 * class body declares its shape.
 */
const KEYWORDS =
	/\b(?:alias|and|attr_accessor|attr_reader|attr_writer|begin|break|case|class|def|do|else|elsif|end|ensure|extend|false|for|if|in|include|module|next|nil|not|or|raise|require_relative|require|rescue|retry|return|self|super|then|true|undef|unless|until|when|while|yield)\b/y;

/**
 * The rules that recognize a value, in the order a scanner has to try them: a
 * comment before the `#` that also opens an interpolation, a keyword before the
 * identifier rules that would claim the same word.
 *
 * A `#{…}` reuses this list, so an expression nested in a string is painted the
 * same as one at the top level.
 */
const expression: Rule[] = [
	{ type: "comment", match: /#[^\n]*/y },

	{ type: "string", match: /"/y, push: "string" },
	{ type: "string", match: /'(?:\\[\s\S]|[^'\\])*'?/y },

	/** A word or symbol list, which carries no interpolation to paint. */
	{
		type: "string",
		match: /%[wWiI](?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>)/y,
	},

	{ type: "constant", match: /:[A-Za-z_]\w*[?!=]?/y },

	/** A hash key and a keyword argument are symbols too, spelled with the colon last. */
	{ type: "constant", match: /\b[A-Za-z_]\w*:(?!:)/y },

	{ type: "variable", match: /@@?[A-Za-z_]\w*|\$[A-Za-z_]\w*/y },

	{
		type: "number",
		match: /\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)\b/y,
	},

	{ type: "keyword", match: KEYWORDS },

	/** A singleton method is declared as `def self.name`, past a keyword and a dot. */
	{ type: "function", match: /(?<=\bdef\s+(?:self\.)?)[A-Za-z_]\w*[?!=]?/y },

	{ type: "class-name", match: /\b[A-Z]\w*/y },
	{ type: "function", match: /\b[a-z_]\w*[?!]?(?=\s*\()/y },

	{
		type: "operator",
		match:
			/<=>|===|=~|!~|\.\.\.?|\*\*=?|\|\|=?|&&=?|&\.|<<|>>|::|=>|->|[!=<>]=|[+\-*/%&|^]=?|[<>=?:!~]/y,
	},
	{ type: "punctuation", match: /[{}[\]();,.]/y },
];

/**
 * Highlights Ruby, painting the expressions inside an interpolated string as
 * code.
 *
 * @example scan('puts "hi #{name}"', ruby)
 */
export const ruby: Grammar = {
	main: expression,

	/**
	 * Inside `"…"`, where the only things that end a run of string are the closing
	 * quote and an interpolation.
	 */
	string: [
		{ type: "string", match: /"/y, pop: true },
		{ type: "punctuation", match: /#\{/y, push: "interpolation" },
		{ type: "string", match: /(?:\\[\s\S]|#(?!\{)|[^"#\\])+/y },
	],

	/**
	 * Inside `#{…}`. A nested `{` pushes this same mode, so the brace that closes
	 * the interpolation is the one that returns to the string.
	 */
	interpolation: [
		{ type: "punctuation", match: /\}/y, pop: true },
		{ type: "punctuation", match: /\{/y, push: "interpolation" },
		...expression,
	],
};
