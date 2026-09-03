/**
 * The Python grammar, including the expressions inside an f-string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer.js";

/**
 * Reserved words, plus `None`: a reader of the language expects it painted like
 * the words it is used alongside rather than like a value.
 *
 * `match` and `case` stay out, since they are only keywords in a statement
 * position and painting `re.match(…)` as one would be worse than leaving both
 * plain.
 */
const KEYWORDS =
	/\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/y;

/**
 * The names the interpreter provides without an import. The list stops at the
 * ones a snippet is likely to reach for, and `self` joins them because it is
 * provided in the same sense even though it is a parameter.
 */
const BUILTINS =
	/\b(?:abs|all|any|bool|dict|enumerate|float|getattr|hasattr|input|isinstance|int|len|list|max|min|open|print|range|repr|self|set|sorted|str|sum|tuple|type|zip)\b/y;

/**
 * The rules that recognize a value, in the order a scanner has to try them: a
 * triple-quoted string before the quote that would end a short one, a keyword
 * before the identifier rules that would claim the same word.
 *
 * An f-string's `{…}` reuses this list, so an expression nested in one is
 * painted the same as one at the top level.
 */
const expression: Rule[] = [
	{ type: "comment", match: /#[^\n]*/y },

	/** A prefix belongs to the string only when it is not the tail of a name. */
	{ type: "string", match: /(?<!\w)[fFrRbBuU]{0,2}"""[\s\S]*?(?:"""|$)/y },
	{ type: "string", match: /(?<!\w)[fFrRbBuU]{0,2}'''[\s\S]*?(?:'''|$)/y },

	{ type: "string", match: /(?<!\w)(?:[fF][rR]?|[rR][fF])"/y, push: "fstring-double" },
	{ type: "string", match: /(?<!\w)(?:[fF][rR]?|[rR][fF])'/y, push: "fstring-single" },

	{ type: "string", match: /(?<!\w)[rRbBuU]{0,2}"(?:\\[\s\S]|[^"\\\n])*"?/y },
	{ type: "string", match: /(?<!\w)[rRbBuU]{0,2}'(?:\\[\s\S]|[^'\\\n])*'?/y },

	{ type: "keyword", match: /@[A-Za-z_]\w*(?:\.\w+)*/y },

	{
		type: "number",
		match:
			/\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?j?)\b/y,
	},
	{ type: "number", match: /\.\d[\d_]*(?:[eE][+-]?\d+)?/y },

	{ type: "boolean", match: /\b(?:True|False)\b/y },
	{ type: "keyword", match: KEYWORDS },
	{ type: "builtin", match: BUILTINS },

	{ type: "class-name", match: /(?<=\bclass\s+)[A-Za-z_]\w*/y },
	{ type: "function", match: /(?<=\bdef\s+)[A-Za-z_]\w*/y },
	{ type: "function", match: /\b[A-Za-z_]\w*(?=\s*\()/y },

	{
		type: "operator",
		match: /\/\/=?|\*\*=?|->|:=|<<=?|>>=?|[!=<>]=|[+\-*/%&|^@]=?|[<>=~]/y,
	},
	{ type: "punctuation", match: /[{}[\]();,.:]/y },
];

/**
 * Highlights Python, painting the expressions inside an f-string as code.
 *
 * @example scan('print(f"{name}")', python)
 */
export const python: Grammar = {
	main: expression,

	/**
	 * Inside `f"…"`. A doubled brace stands for a literal one, so it stays part of
	 * the string rather than opening a replacement field.
	 */
	"fstring-double": [
		{ type: "string", match: /"/y, pop: true },
		{ type: "string", match: /\{\{|\}\}/y },
		{ type: "punctuation", match: /\{/y, push: "interpolation" },
		{ type: "string", match: /(?:\\[\s\S]|[^"\\{}\n])+/y },
	],

	"fstring-single": [
		{ type: "string", match: /'/y, pop: true },
		{ type: "string", match: /\{\{|\}\}/y },
		{ type: "punctuation", match: /\{/y, push: "interpolation" },
		{ type: "string", match: /(?:\\[\s\S]|[^'\\{}\n])+/y },
	],

	/**
	 * Inside an f-string's `{…}`. A nested `{` pushes this same mode, so the brace
	 * that closes the replacement field is the one that returns to the string.
	 */
	interpolation: [
		{ type: "punctuation", match: /\}/y, pop: true },
		{ type: "punctuation", match: /\{/y, push: "interpolation" },
		...expression,
	],
};
