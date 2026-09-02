/**
 * The JSON grammar, which also serves the fences written as JSONC.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer";

/**
 * Highlights JSON, including the comments and trailing commas a `jsonc` fence
 * carries: a configuration file is the shape most of these fences hold.
 *
 * @example scan('{ "a": 1 }', json)
 */
export const json: Grammar = {
	main: [
		{ type: "comment", match: /\/\/[^\n]*/y },
		{ type: "comment", match: /\/\*(?:[^*]|\*(?!\/))*(?:\*\/)?/y },

		/** A quoted string a colon follows is the name of a member, not a value. */
		{ type: "property", match: /"(?:\\[\s\S]|[^"\\\n])*"(?=\s*:)/y },
		{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },

		/**
		 * A number claims the run only when it is the whole of it, so a version or a
		 * date written without quotes stays one unpainted run rather than a number
		 * and a remainder.
		 */
		{ type: "number", match: /(?<![\w.-])-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w.-])/y },

		{ type: "boolean", match: /\b(?:true|false)\b/y },
		{ type: "keyword", match: /\bnull\b/y },

		{ type: "operator", match: /:/y },
		{ type: "punctuation", match: /[{}[\],]/y },
	],
};
