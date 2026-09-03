/**
 * The YAML grammar, sized for the two shapes a fence holds: a service
 * configuration, and a document's frontmatter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer.js";

/**
 * Highlights YAML, leaving the body of a block scalar as the literal text it is.
 *
 * @example scan("title: Hello\ntags: [a]\n", yaml)
 */
export const yaml: Grammar = {
	main: [
		/** A `#` opens a comment where a space precedes it, and is text inside a word. */
		{ type: "comment", match: /(?<=^|[ \t])#[^\n]*/my },

		{ type: "punctuation", match: /^(?:---|\.\.\.)(?=[ \t]|$)/my },

		/**
		 * A key sits at the head of its line, after the dash of the sequence entry it
		 * opens, or after the brace or comma of a flow mapping.
		 */
		{
			type: "property",
			match:
				/(?<=^[ \t]*(?:-[ \t]+)?|[{,][ \t]*)(?:[\w.-]+|<<|"[^"\n]*"|'[^'\n]*')(?=[ \t]*:(?:[ \t]|$))/my,
		},

		/**
		 * A value's colon and a sequence's dash are the two places a value starts,
		 * which is what bounds this rule and the plain scalar below: a `|` inside a
		 * scalar is text, and a word in a scalar is not a key.
		 */
		{ type: "punctuation", match: /(?<=:[ \t]+|^[ \t]*-[ \t]+)[|>][\d+-]{0,2}/my, push: "block" },

		{ type: "punctuation", match: /(?<=^[ \t]*)-(?=[ \t]|$)/my },

		{ type: "variable", match: /[&*][\w-]+/y },
		{ type: "keyword", match: /!!?[\w:.-]*/y },

		{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },
		{ type: "string", match: /'(?:''|[^'\n])*'?/y },

		{ type: "number", match: /(?<![\w.-])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w.-])/y },
		{ type: "boolean", match: /(?<![\w-])(?:true|false)(?![\w-])/iy },
		{ type: "keyword", match: /(?<![\w-])(?:null|~)(?![\w-])/iy },

		/**
		 * A plain scalar runs to the end of its line, stopping at the comment that
		 * may close it. A value inside a flow collection ends at a bracket instead,
		 * so a run holding one stays unpainted rather than swallowing it.
		 */
		{
			type: "string",
			match: /(?<=:[ \t]+|^[ \t]*-[ \t]+)[^\s#[{][^\n}\]]*?(?=[ \t]+#|[ \t]*$)/my,
		},

		{ type: "punctuation", match: /[:,[\]{}?]/y },
	],

	/**
	 * Inside a block scalar, where the body is literal text rather than YAML. The
	 * backreference holds the indentation of the first body line, so the block ends
	 * at the first line indented less than that.
	 */
	block: [
		{ type: "string", match: /[ \t]*\n([ \t]+)[^\n]*(?:\n\1[^\n]*|\n(?=[ \t]*\n))*/y, pop: true },
		{ type: "plain", match: /\n/y, pop: true },
		{ type: "string", match: /[^\n]+/y },
	],
};
