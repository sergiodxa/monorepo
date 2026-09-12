/**
 * Neutralizes text before it is written. A `text` node holds whatever a visitor
 * put in it, so every character that could open a construct is escaped here,
 * which is what keeps a second parse of the output standing on the same tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { matchLiteralEmail, matchLiteralUrl } from "../inline/scan.js";

/** Characters that open a construct wherever they sit, so they escape unconditionally. */
const ANYWHERE = new Set(["\\", "*", "_", "`", "[", "]", "<", "~"]);

/** Characters that open a block only as the first thing on a line. */
const LINE_LEADING = new Set(["#", ">", "+", "-", "="]);

/** An ordered list marker, whose escape lands on the delimiter because a digit cannot carry one. */
const ORDERED_MARKER = /^(\d+)([.)])/;

/** The letters a literal autolink can begin with, which is the cheap test before the scan. */
const URL_START = /[fhw]/i;

/** The scheme's own punctuation, which carries the escape because the letters cannot. */
const SCHEME_DELIMITER = /[:.]/;

/**
 * Neutralizes the literal autolink the parser would find here, escaping the scheme's
 * own punctuation since the letters ahead of it cannot carry a backslash.
 *
 * @param value - The text being written
 * @param index - Where the scheme would begin
 * @returns The scheme as written and how far it reaches, or `null` where no link begins
 */
function escapeScheme(value: string, index: number): { text: string; length: number } | null {
	if (matchLiteralUrl(value, index, 0, value.length) === null) return null;

	let cut = value.slice(index).search(SCHEME_DELIMITER);
	if (cut < 0) return null;

	return {
		text: `${value.slice(index, index + cut)}\\${value.charAt(index + cut)}`,
		length: cut + 1,
	};
}

/** Where a run of text sits, which is what decides the two context-dependent escapes. */
export interface EscapeContext {
	/** Whether the run opens a line, where `#`, `>`, `-`, `+`, `=` and `1.` mark a block. */
	lineStart: boolean;
	/** Whether the run sits in a table cell, where `|` ends the cell. */
	table: boolean;
}

/**
 * Writes text so the parser reads it back as the same characters.
 *
 * @param value - The text to write
 * @param context - Where the run sits, for the line-leading and table escapes
 * @returns The text with every construct opener escaped
 * @example escapeText("a * b", { lineStart: false, table: false })
 */
export function escapeText(value: string, context: EscapeContext): string {
	let out = "";
	let lineStart = context.lineStart;
	let index = 0;

	while (index < value.length) {
		let char = value[index] ?? "";

		if (char === "\n") {
			out += char;
			lineStart = true;
			index += 1;
			continue;
		}

		if (lineStart) {
			let ordered = ORDERED_MARKER.exec(value.slice(index));
			if (ordered) {
				out += `${ordered[1]}\\${ordered[2]}`;
				index += ordered[0].length;
				lineStart = false;
				continue;
			}

			if (LINE_LEADING.has(char)) {
				out += `\\${char}`;
				index += 1;
				lineStart = false;
				continue;
			}
		}

		if (char === "{" && value[index + 1] === "%") {
			out += "\\{%";
			index += 2;
			lineStart = false;
			continue;
		}

		if (char === "@" && matchLiteralEmail(value, index, 0, value.length) !== null) {
			out += "\\@";
			index += 1;
			lineStart = false;
			continue;
		}

		if (URL_START.test(char)) {
			let scheme = escapeScheme(value, index);
			if (scheme !== null) {
				out += scheme.text;
				index += scheme.length;
				lineStart = false;
				continue;
			}
		}

		if (ANYWHERE.has(char) || (context.table && char === "|")) {
			out += `\\${char}`;
			index += 1;
			lineStart = false;
			continue;
		}

		out += char;
		if (char !== " " && char !== "\t") lineStart = false;
		index += 1;
	}

	return out;
}

/**
 * Measures the longest unbroken run of one character, which is what a fence has to
 * outgrow to close where it is meant to.
 *
 * @param value - The text to measure
 * @param char - The character the run is made of
 * @returns The length of the longest run
 * @example longestRun("a ``b`` c", "`")
 */
export function longestRun(value: string, char: string): number {
	let longest = 0;
	let current = 0;

	for (let index = 0; index < value.length; index += 1) {
		if (value[index] === char) {
			current += 1;
			if (current > longest) longest = current;
		} else current = 0;
	}

	return longest;
}
