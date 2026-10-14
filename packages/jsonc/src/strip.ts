/**
 * The lexical pass that turns JSONC into JSON of exactly the same length: comments, trailing
 * commas and a leading byte-order mark become spaces, so every offset into the result is also
 * an offset into the text the user wrote, and an error found later points at their file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A problem at a position in the text, before it is turned into a line and column. */
export interface Issue {
	offset: number;
	reason: string;
}

/** The stripped text, and the unterminated block comment that cut it short, when there is one. */
export interface Scan {
	text: string;
	issue: Issue | null;
}

/** The characters after which a comma follows no value, so it is never a trailing comma. */
const NOT_AFTER_VALUE = new Set(["[", "{", ",", ":"]);

/**
 * JSONC text as same-length JSON: `//` and `/* *\/` comments and trailing commas in objects and
 * arrays become spaces, outside strings only, with the line breaks inside a block comment kept
 * so line numbers survive. A comma counts as trailing only after a value, so `[,]` stays invalid.
 *
 * @example strip('{ "a": 1, // one\n}') // '{ "a": 1         \n}'
 */
export function strip(text: string): string {
	return scan(text).text;
}

/** {@link strip}, also reporting a block comment that never closes, which `parse` rejects. */
export function scan(text: string): Scan {
	let output = text.split("");
	let issue: Issue | null = null;
	let previous: string | null = null;
	let index = 0;
	if (text.charCodeAt(0) === 0xfeff) {
		output[0] = " ";
		index = 1;
	}
	while (index < text.length) {
		let char = text[index] as string;
		if (char === '"') {
			index = stringEnd(text, index);
			previous = '"';
			continue;
		}
		if (char === "/" && (text[index + 1] === "/" || text[index + 1] === "*")) {
			let end = commentEnd(text, index);
			if (end === -1) {
				issue ??= { offset: index, reason: "Unterminated block comment" };
				end = text.length;
			}
			blank(output, index, end);
			index = end;
			continue;
		}
		if (char === "," && previous !== null && !NOT_AFTER_VALUE.has(previous)) {
			let next = text[significantAfter(text, index + 1)];
			if (next === "}" || next === "]") output[index] = " ";
		}
		if (!isWhitespace(char)) previous = char;
		index += 1;
	}
	return { text: output.join(""), issue };
}

/** The index just past the string opening at `start`, or the end of the text when it never closes. */
function stringEnd(text: string, start: number): number {
	let index = start + 1;
	while (index < text.length) {
		let char = text[index];
		if (char === "\\") index += 2;
		else if (char === '"') return index + 1;
		else index += 1;
	}
	return text.length;
}

/** The index just past the comment opening at `start`; `-1` for a block comment that never closes. */
function commentEnd(text: string, start: number): number {
	if (text[start + 1] === "/") {
		let index = start + 2;
		while (index < text.length && text[index] !== "\n" && text[index] !== "\r") index += 1;
		return index;
	}
	let close = text.indexOf("*/", start + 2);
	return close === -1 ? -1 : close + 2;
}

/** The index of the first character at or after `start` that is neither whitespace nor a comment. */
function significantAfter(text: string, start: number): number {
	let index = start;
	while (index < text.length) {
		let char = text[index] as string;
		if (isWhitespace(char)) {
			index += 1;
		} else if (char === "/" && (text[index + 1] === "/" || text[index + 1] === "*")) {
			let end = commentEnd(text, index);
			if (end === -1) return text.length;
			index = end;
		} else {
			return index;
		}
	}
	return index;
}

/** Replaces `[start, end)` with spaces, keeping line breaks where they were. */
function blank(output: string[], start: number, end: number): void {
	for (let index = start; index < end; index += 1) {
		let char = output[index];
		if (char !== "\n" && char !== "\r") output[index] = " ";
	}
}

/** JSON's four whitespace characters; anything else between tokens is an error. */
export function isWhitespace(char: string | undefined): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r";
}
