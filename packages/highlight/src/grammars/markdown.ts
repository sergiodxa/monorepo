/**
 * The Markdown grammar, for the fence that shows markdown rather than uses it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer";

/**
 * Code between backticks, which outranks every inline marker so a span of code
 * holding an asterisk or a pipe reads as code.
 */
const CODE: Rule = { type: "string", match: /``(?:[^`]|`(?!`))+``|`[^`\n]+`/y };

/**
 * Highlights Markdown. A fenced block's body stays plain, since a fence names a
 * language this grammar knows nothing about.
 *
 * @example scan("# Title\n\nSome **bold** text.\n", markdown)
 */
export const markdown: Grammar = {
	main: [
		/** An escaped marker is text, so the pair goes before every rule that reads one. */
		{ type: "plain", match: /\\[\\`*_{}[\]()#+\-.!|>~]/y },

		{ type: "punctuation", match: /(?<=^[ \t]*)(?:`{3,}|~{3,})/my, push: "code" },
		{ type: "punctuation", match: /(?<=^[ \t]*)#{1,6}(?=[ \t]|$)/my, push: "heading" },

		/** A divider outranks the list marker, so a line of three dashes reads as one. */
		{
			type: "punctuation",
			match:
				/(?<=^ {0,3})(?:-[ \t]?-[ \t]?-[-\t ]*|\*[ \t]?\*[ \t]?\*[*\t ]*|_[ \t]?_[ \t]?_[_\t ]*)$/my,
		},

		{ type: "punctuation", match: /(?<=^[ \t]*)>/my },
		{ type: "punctuation", match: /(?<=^[ \t]*)(?:[-*+]|\d{1,9}[.)])(?=[ \t]|$)/my },

		CODE,

		/**
		 * A bracket opens a link only where the whole of one follows it, which keeps
		 * a checklist's `[x]` and a footnote's `[1]` as the text they are and lets
		 * the closing rules below anchor themselves to the `](` they follow.
		 */
		{ type: "punctuation", match: /!?\[(?=[^[\]\n]*\]\([^)\n]*\))/y },
		{ type: "punctuation", match: /\](?=\([^)\n]*\))/y },
		{ type: "punctuation", match: /(?<=\])\(/y },
		{ type: "attr-value", match: /(?<=\]\()[^)\s]+/y },
		/** The paren leads, so the scan back for the `](` runs where one can close a link. */
		{ type: "punctuation", match: /\)(?<=\]\([^)\n]*\))/y },

		/**
		 * Emphasis opens only where its closing marker follows on the same line, so
		 * an unpaired marker stays text and the mode it would push always ends. An
		 * underscore also has to stand outside a word, which is what keeps a
		 * `snake_case` name whole.
		 */
		{ type: "punctuation", match: /\*\*(?=(?:[^*\n]|\*(?!\*))+\*\*)/y, push: "strong" },
		{ type: "punctuation", match: /(?<![\w*])__(?=(?:[^_\n]|_(?!_))+__)/y, push: "strong" },
		{ type: "punctuation", match: /\*(?=[^\s*][^*\n]*\*)/y, push: "emphasis" },
		{ type: "punctuation", match: /(?<![\w*])_(?=[^\s_][^_\n]*_(?!\w))/y, push: "emphasis" },

		{ type: "punctuation", match: /\|/y },
		{ type: "punctuation", match: /(?<=\|[ \t]{0,8}):?-{2,}:?/y },
	],

	/**
	 * Inside a fenced block. The info string is painted where it sits — right after
	 * the opening marker — and every other line is the fenced language's, so it
	 * stays plain until the closing marker.
	 */
	code: [
		{ type: "punctuation", match: /(?<=^[ \t]*)(?:`{3,}|~{3,})[ \t]*$/my, pop: true },
		{ type: "keyword", match: /(?<=^[ \t]*(?:`{3,}|~{3,}))[A-Za-z][\w#+.-]*/my },
		{ type: "attr-value", match: /(?<=^[ \t]*(?:`{3,}|~{3,})[A-Za-z][\w#+.-]*)[^\n]+/my },
	],

	/** Inside a heading, which ends where its line does. */
	heading: [
		{ type: "plain", match: /\n/y, pop: true },
		CODE,
		{ type: "keyword", match: /[^`\n]+/y },
	],

	/** Inside `**bold**`, where a lone marker is part of the emphasized text. */
	strong: [
		{ type: "punctuation", match: /\*\*|__/y, pop: true },
		CODE,
		{ type: "constant", match: /(?:[^*_`\n]|[*_](?![*_]))+/y },
	],

	/** Inside `_italic_`. */
	emphasis: [
		{ type: "punctuation", match: /[*_]/y, pop: true },
		CODE,
		{ type: "constant", match: /[^*_`\n]+/y },
	],
};
