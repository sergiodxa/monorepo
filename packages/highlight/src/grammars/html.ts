/**
 * The markup grammar, general enough for every dialect spelled with tags, with
 * a stylesheet and a script embedded where a document opens one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer";

import { compose } from "../lexer";

import { css } from "./css";
import { javascript } from "./javascript";

/**
 * Each embedded language split into the rules its body starts with and the
 * modes those rules push. The modes are merged in below, so a stylesheet's
 * block and a template literal are scanned by the language that owns them.
 */
const { main: stylesheet, ...stylesheetModes } = css;
const { main: expression, ...expressionModes } = javascript;

/**
 * Tags, text, and the two element bodies that hold another language.
 */
const markup: Grammar = {
	main: [
		{ type: "comment", match: /<!--(?:[^-]|-(?!->))*(?:-->)?/y },
		/** A CDATA section, whose content a parser hands over as text. */
		{ type: "comment", match: /<!\[CDATA\[(?:[^\]]|\](?!\]>))*(?:\]\]>)?/y },
		/** A prolog, then a doctype and the declarations one carries. */
		{ type: "keyword", match: /<\?(?:[^?]|\?(?!>))*(?:\?>)?/y },
		{ type: "keyword", match: /<!(?!--)[^>]*>?/y },
		{ type: "punctuation", match: /<\/?(?=[A-Za-z_])/y, push: "tag" },
		{ type: "constant", match: /&(?:#(?:\d+|[xX][\da-fA-F]+)|[A-Za-z][\w-]*);/y },
	],

	/**
	 * A tag's name and attribute list, from the bracket that opened it to the one
	 * that closes it. Every dialect names its own elements, so a name is whatever
	 * a name may be spelled with rather than a member of a list.
	 */
	tag: [
		{ type: "tag", match: /(?<=[<\/])[A-Za-z_][\w:.-]*/y },
		/**
		 * The bracket that opens a body written in another language. Reaching back
		 * over the attributes is safe because a bracket is exactly what they cannot
		 * contain, so the name the lookbehind finds is this tag's own.
		 */
		{ type: "punctuation", match: /(?<=<style[^>]*)>/iy, push: "style" },
		{ type: "punctuation", match: /(?<=<script[^>]*)>/iy, push: "script" },
		{ type: "punctuation", match: /\/?>/y, pop: true },
		{ type: "attr-value", match: /"[^"]*"?/y },
		{ type: "attr-value", match: /'[^']*'?/y },
		/** A value written bare, which the `=` before it is what marks. */
		{ type: "attr-value", match: /(?<==\s*)[^\s"'=<>`]+/y },
		{ type: "operator", match: /=/y },
		{ type: "attr-name", match: /[^\s"'=<>\/]+/y },
	],

	/**
	 * A stylesheet, up to the closing tag. Ending the body on the `</` returns
	 * the name and the bracket after it to markup, where they belong.
	 */
	style: [{ type: "punctuation", match: /<\/(?=style)/iy, pop: true }, ...stylesheet],

	script: [{ type: "punctuation", match: /<\/(?=script)/iy, pop: true }, ...expression],
};

/**
 * Highlights markup, and the CSS and JavaScript a document embeds in it.
 *
 * @example scan("<p class='a'>hi</p>", html)
 */
export const html: Grammar = compose(markup, stylesheetModes, expressionModes);
