/**
 * Link reference definitions, read off the front of a paragraph and folded into
 * the document's map. They exist in the source and not in the tree, so a document
 * written back from the AST carries inline links where its references stood.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unescapeString } from "../inline/scan.js";

/** A definition as read, together with where the paragraph text resumes after it. */
export interface Definition {
	/** The label as written, before normalization. */
	label: string;
	href: string;
	title?: string;
	/** Index one past the definition, which is the start of the next line. */
	end: number;
}

/** The longest label CommonMark reads; anything beyond it is ordinary text. */
const LABEL_LIMIT = 999;

/**
 * The identifier a footnote definition carries and a reference points at.
 * Internal whitespace collapses to one space and case folds away, and the result
 * stays readable so a renderer can build an anchor out of it.
 *
 * @param label - The label as written, without its brackets or caret
 * @returns The identifier both halves of a footnote agree on
 */
export function normalizeIdentifier(label: string): string {
	return label
		.trim()
		.replace(/[ \t\r\n]+/g, " ")
		.toLowerCase();
}

/**
 * Reads one definition beginning at `start`. A definition owns whole lines, so
 * the returned `end` always sits at a line boundary and the caller drops exactly
 * that many collected lines.
 *
 * @param text - The paragraph's collected text
 * @param start - Index of the `[` the definition opens with
 * @returns The definition, or `null` when the text holds ordinary paragraph content
 */
export function readDefinition(text: string, start: number): Definition | null {
	let label = readLabel(text, start);
	if (!label) return null;

	let index = label.end;
	if (text.charAt(index) !== ":") return null;
	index += 1;

	let afterColon = skipWhitespace(text, index, true);
	if (afterColon === null) return null;

	let destination = readDestination(text, afterColon);
	if (!destination) return null;

	let title = readTrailingTitle(text, destination.end);
	if (title) {
		let titled = endOfLine(text, title.end);
		if (titled !== null) {
			return { label: label.value, href: destination.value, title: title.value, end: titled };
		}
	}

	let end = endOfLine(text, destination.end);
	if (end === null) return null;

	return { label: label.value, href: destination.value, end };
}

/** The bracketed label, with nested brackets rejected the way CommonMark rejects them. */
function readLabel(text: string, start: number): { value: string; end: number } | null {
	if (text.charAt(start) !== "[") return null;

	let index = start + 1;
	let value = "";

	while (index < text.length) {
		let char = text.charAt(index);

		if (char === "\\") {
			value += char + text.charAt(index + 1);
			index += 2;
			continue;
		}

		if (char === "]") break;
		if (char === "[") return null;

		value += char;
		index += 1;
	}

	if (text.charAt(index) !== "]") return null;
	if (value.length > LABEL_LIMIT) return null;
	if (value.trim() === "") return null;

	return { value, end: index + 1 };
}

/**
 * Whitespace between a definition's parts. At most one newline may appear, so a
 * blank line ends the definition rather than letting the next paragraph's first
 * line become a destination.
 *
 * @param text - The paragraph's collected text
 * @param start - Where to begin skipping
 * @param allowNewline - Whether a single newline may be crossed
 * @returns The first index that is not whitespace, or `null` when a blank line intervened
 */
function skipWhitespace(text: string, start: number, allowNewline: boolean): number | null {
	let index = start;
	let newlines = 0;

	while (index < text.length) {
		let char = text.charAt(index);
		if (char === "\n") {
			newlines += 1;
			if (!allowNewline || newlines > 1) return null;
		} else if (char !== " " && char !== "\t") break;
		index += 1;
	}

	return index;
}

/**
 * A destination, either angle-bracketed or a bare run whose parentheses balance.
 * The scan keeps every escape as written so the value it returns is resolved in
 * one pass, the same way an inline link's destination is.
 */
function readDestination(text: string, start: number): { value: string; end: number } | null {
	if (text.charAt(start) === "<") return readBracketedDestination(text, start);

	let index = start;
	let value = "";
	let depth = 0;

	while (index < text.length) {
		let char = text.charAt(index);

		if (char === "\\" && isPunctuation(text.charAt(index + 1))) {
			value += char + text.charAt(index + 1);
			index += 2;
			continue;
		}

		if (char === "(") depth += 1;
		if (char === ")") {
			depth -= 1;
			if (depth < 0) break;
		}

		if (isBlankOrControl(char)) break;

		value += char;
		index += 1;
	}

	if (value === "" || depth !== 0) return null;

	return { value: unescapeString(value), end: index };
}

/** The `<…>` form, which may hold spaces but never a newline or an unescaped angle. */
function readBracketedDestination(
	text: string,
	start: number,
): { value: string; end: number } | null {
	let index = start + 1;
	let value = "";

	while (index < text.length) {
		let char = text.charAt(index);

		if (char === "\\" && isPunctuation(text.charAt(index + 1))) {
			value += char + text.charAt(index + 1);
			index += 2;
			continue;
		}

		if (char === "\n" || char === "<") return null;
		if (char === ">") return { value: unescapeString(value), end: index + 1 };

		value += char;
		index += 1;
	}

	return null;
}

/** The optional title, which must be separated from the destination by whitespace. */
function readTrailingTitle(text: string, start: number): { value: string; end: number } | null {
	let index = skipWhitespace(text, start, true);
	if (index === null || index === start) return null;

	let opener = text.charAt(index);
	let closer = opener === "(" ? ")" : opener;
	if (opener !== '"' && opener !== "'" && opener !== "(") return null;

	let cursor = index + 1;
	let value = "";

	while (cursor < text.length) {
		let char = text.charAt(cursor);

		if (char === "\\" && isPunctuation(text.charAt(cursor + 1))) {
			value += char + text.charAt(cursor + 1);
			cursor += 2;
			continue;
		}

		if (char === closer) return { value: unescapeString(value), end: cursor + 1 };
		if (char === opener && opener === "(") return null;

		value += char;
		cursor += 1;
	}

	return null;
}

/**
 * Confirms a definition ends its line, which is what tells a real definition from
 * a paragraph that merely opens like one.
 *
 * @param text - The paragraph's collected text
 * @param start - Index just past the destination or title
 * @returns The index the next line begins at, or `null` when other content follows
 */
function endOfLine(text: string, start: number): number | null {
	let index = start;

	while (index < text.length && (text.charAt(index) === " " || text.charAt(index) === "\t")) {
		index += 1;
	}

	if (index >= text.length) return text.length;
	if (text.charAt(index) === "\n") return index + 1;

	return null;
}

/** Whitespace and control characters, which is where a bare destination stops. */
function isBlankOrControl(char: string): boolean {
	return char.charCodeAt(0) <= 0x20;
}

/** ASCII punctuation, which is the set a backslash may escape. */
function isPunctuation(char: string): boolean {
	return char !== "" && /[!-/:-@[-`{-~]/.test(char);
}
