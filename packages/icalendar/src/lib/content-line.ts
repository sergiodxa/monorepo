/**
 * The content-line layer of RFC 5545 §3.1: unfolding physical lines into logical ones,
 * folding written lines at 75 octets, and reading or writing a line's name, parameters
 * (quoted and RFC 6868 caret-encoded) and value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { ICalendar } from "../types.js";

/** A logical line after unfolding, with the physical line it starts on for error messages. */
export interface ContentLine {
	text: string;
	line: number;
}

/** The longest a physical line may be, in octets, not counting its CRLF. */
const MAX_LINE_OCTETS = 75;

/** Characters a property or parameter name is made of (`iana-token` and `x-name`). */
const NAME_CHARACTER = /[A-Za-z0-9-]/;

/**
 * Joins folded lines back into logical ones. A line starting with a space or tab continues
 * the previous one minus that one character; CRLF, LF and CR endings are all accepted, and
 * blank lines are skipped.
 *
 * @param source - The calendar text
 * @returns The logical lines, in order
 */
export function unfold(source: string): ContentLine[] {
	let text = source.startsWith("\uFEFF") ? source.slice(1) : source;
	let lines: ContentLine[] = [];
	let physical = text.split(/\r\n|\r|\n/);
	for (let index = 0; index < physical.length; index++) {
		let line = physical[index] ?? "";
		let previous = lines.at(-1);
		if ((line.startsWith(" ") || line.startsWith("\t")) && previous) previous.text += line.slice(1);
		else if (line !== "") lines.push({ text: line, line: index + 1 });
	}
	return lines;
}

/**
 * The octets a code point takes in UTF-8.
 *
 * @param codePoint - A Unicode code point
 * @returns `1` to `4`
 */
function utf8Length(codePoint: number): number {
	if (codePoint < 0x80) return 1;
	if (codePoint < 0x800) return 2;
	if (codePoint < 0x10000) return 3;
	return 4;
}

/**
 * Folds a logical line into physical lines of at most 75 octets each, the continuation's
 * leading space included. Breaks fall between code points, so a multi-byte character always
 * stays whole on one line.
 *
 * @param line - The logical line
 * @returns The physical lines joined by CRLF, without a trailing CRLF
 */
export function fold(line: string): string {
	let physical: string[] = [];
	let current = "";
	let size = 0;
	for (let character of line) {
		let length = utf8Length(character.codePointAt(0) ?? 0);
		if (size + length > MAX_LINE_OCTETS) {
			physical.push(current);
			current = " ";
			size = 1;
		}
		current += character;
		size += length;
	}
	physical.push(current);
	return physical.join("\r\n");
}

/**
 * Undoes RFC 6868 caret encoding: `^n` is a newline, `^'` a double quote and `^^` a caret.
 * Any other caret stands for itself, as the RFC asks.
 *
 * @param value - A parameter value as written, without its quotes
 * @returns The decoded value
 */
function decodeParameterValue(value: string): string {
	return value.replaceAll(/\^([n'^])/g, (_, code: string) => {
		if (code === "n") return "\n";
		if (code === "'") return '"';
		return "^";
	});
}

/**
 * Writes a parameter value: RFC 6868 carets for newlines, double quotes and carets, then
 * double quotes around it when it holds a colon, semicolon or comma.
 *
 * @param value - The decoded value
 * @returns The value as written
 */
function encodeParameterValue(value: string): string {
	let encoded = value
		.replaceAll("^", "^^")
		.replaceAll(/\r\n|\r|\n/g, "^n")
		.replaceAll('"', "^'");
	return /[:;,]/.test(encoded) ? `"${encoded}"` : encoded;
}

/**
 * Reads a name at a position: the run of name characters starting there.
 *
 * @param text - The logical line
 * @param start - Where the name starts
 * @returns The name, empty when none starts there
 */
function readName(text: string, start: number): string {
	let end = start;
	while (end < text.length && NAME_CHARACTER.test(text[end] ?? "")) end++;
	return text.slice(start, end);
}

/**
 * Reads one logical line into a property. Names come back upper-cased, parameter values
 * unquoted and caret-decoded, and the value exactly as written after the first `:` that
 * sits outside a quoted parameter.
 *
 * @param text - A logical line
 * @returns The property, or why the line is not a content line
 */
export function parseContentLine(text: string): Result<ICalendar.Property, Error> {
	let name = readName(text, 0);
	if (name === "") return failure(new Error("a content line has to start with a property name"));
	let parameters: Record<string, string[]> = {};
	let index = name.length;
	while (text[index] === ";") {
		let parameterName = readName(text, index + 1);
		if (parameterName === "") return failure(new Error(`a parameter of ${name} has no name`));
		index += parameterName.length + 1;
		if (text[index] !== "=") return failure(new Error(`parameter ${parameterName} has no "="`));
		let values = (parameters[parameterName.toUpperCase()] ??= []);
		do {
			index++;
			if (text[index] === '"') {
				let close = text.indexOf('"', index + 1);
				if (close === -1)
					return failure(new Error(`parameter ${parameterName} has an unclosed quote`));
				values.push(decodeParameterValue(text.slice(index + 1, close)));
				index = close + 1;
			} else {
				let start = index;
				while (index < text.length && !";:,".includes(text[index] ?? "")) index++;
				values.push(decodeParameterValue(text.slice(start, index)));
			}
		} while (text[index] === ",");
	}
	if (text[index] !== ":") return failure(new Error(`${name} has no ":" before its value`));
	return success({ name: name.toUpperCase(), parameters, value: text.slice(index + 1) });
}

/**
 * Writes a property as folded content lines. Parameters with no values are left out, and
 * the value is written as given, so TEXT values must arrive escaped.
 *
 * @param property - The property to write
 * @returns The physical lines joined by CRLF, without a trailing CRLF
 */
export function formatContentLine(property: ICalendar.Property): string {
	let line = property.name.toUpperCase();
	for (let [name, values] of Object.entries(property.parameters)) {
		if (values.length === 0) continue;
		line += `;${name.toUpperCase()}=${values.map(encodeParameterValue).join(",")}`;
	}
	return fold(`${line}:${property.value}`);
}
