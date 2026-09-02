/**
 * The JavaScript grammar, and the rule list TypeScript and JSX extend.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer";

/**
 * Words that are reserved, plus the literals spelled as words: painting `null`
 * and `undefined` as keywords is what a reader of the language expects. A word
 * after a `.` is a member being reached for, so `u.var()` keeps its own name.
 */
const KEYWORDS =
	/(?<!\.)\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|let|new|null|of|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/y;

/**
 * The rules that recognize a value, in the order a scanner has to try them: a
 * comment before the `/` that opens it reads as an operator, a keyword before
 * the identifier rules that would claim the same word.
 *
 * TypeScript and JSX build on this list rather than restating it.
 */
export const expression: Rule[] = [
	{ type: "comment", match: /\/\/[^\n]*/y },
	{ type: "comment", match: /\/\*(?:[^*]|\*(?!\/))*(?:\*\/)?/y },

	{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },
	{ type: "string", match: /'(?:\\[\s\S]|[^'\\\n])*'?/y },
	{ type: "string", match: /`/y, push: "template" },

	/**
	 * A `/` opens a regular expression only where a value can start, which is
	 * what the lookbehind checks: after an operator, an opening bracket, or a
	 * keyword like `return`. Anywhere else it divides.
	 */
	{
		type: "regex",
		match:
			/(?<=(?:^|[([{,;:=!&|?+\-*/%~^<>]|\breturn|\btypeof|\bcase)\s*)\/(?:\\.|\[(?:\\.|[^\]\n])*\]|[^/\\\n])+\/[dgimsuvy]*/y,
	},

	{
		type: "number",
		match:
			/\b(?:0[xX][\da-fA-F][\da-fA-F_]*|0[bB][01][01_]*|0[oO][0-7][0-7_]*|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?)n?\b/y,
	},
	{ type: "number", match: /\.\d[\d_]*(?:[eE][+-]?\d+)?/y },
	{ type: "number", match: /\bInfinity\b|\bNaN\b/y },

	{ type: "boolean", match: /\b(?:true|false)\b/y },
	{ type: "keyword", match: KEYWORDS },

	/**
	 * A key in an object literal, which is what following a `{` or a `,` marks it
	 * as. A quoted key is a string, claimed by the rule above.
	 */
	{ type: "property", match: /(?<=[{,]\s*)[A-Za-z_$][\w$]*(?=\s*:)/y },

	{ type: "constant", match: /\b[A-Z][A-Z\d]*(?:_[A-Z\d]+)+\b/y },
	{ type: "class-name", match: /\b[A-Z][\w$]*\b/y },
	{ type: "function", match: /#?\b[A-Za-z_$][\w$]*(?=\s*(?:\?\.)?\s*\()/y },
	{ type: "variable", match: /#[A-Za-z_$][\w$]*/y },

	{
		type: "operator",
		match:
			/=>|\.{3}|\?\?=?|\?\.|&&=?|\|\|=?|\*\*=?|[<>]{2,3}=?|[+\-*/%&|^]=?|[!=]==?|[<>]=?|[~?:=!]/y,
	},
	{ type: "punctuation", match: /[{}[\]();,.]/y },
];

/**
 * Highlights JavaScript, including the expressions inside a template literal.
 *
 * @example scan('let x = `a${b}`', javascript)
 */
export const javascript: Grammar = {
	main: expression,

	/**
	 * Inside a template literal, where the only things that end a run of string
	 * are the closing backtick and an interpolation.
	 */
	template: [
		{ type: "string", match: /`/y, pop: true },
		{ type: "punctuation", match: /\$\{/y, push: "interpolation" },
		{ type: "string", match: /(?:\\[\s\S]|\$(?!\{)|[^`$\\])+/y },
	],

	/**
	 * Inside `${…}`. A nested `{` pushes this same mode, so the brace that closes
	 * the interpolation is the one that returns to the template.
	 */
	interpolation: [
		{ type: "punctuation", match: /\}/y, pop: true },
		{ type: "punctuation", match: /\{/y, push: "interpolation" },
		...expression,
	],
};
