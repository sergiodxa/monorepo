/**
 * A strict JSON grammar walk over stripped text that finds the first character breaking it.
 * `JSON.parse` stays the authority on what is accepted; this walk only names where it failed,
 * at the same index V8 reports, because some engines' messages carry no position at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Issue } from "./strip.js";

import { isWhitespace } from "./strip.js";

/** The escapes JSON allows after a backslash, `u` aside. */
const SIMPLE_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);

/** The three literal values, by their first character. */
const LITERALS: Record<string, string> = { t: "true", f: "false", n: "null" };

/** Where the walk resumes after a value; a value outside any container ends the document. */
type Container = "array" | "object";

/**
 * The first grammar violation in JSON `text`, or `null` when it is valid. Containers are kept on
 * an explicit stack, so nesting as deep as `JSON.parse` accepts never overflows the call stack.
 */
export function check(text: string): Issue | null {
	let stack: Container[] = [];
	let index = skipWhitespace(text, 0);
	while (true) {
		let value = readValue(text, index, stack);
		if ("reason" in value) return value;
		index = value.next;
		if (value.opened) continue;
		while (true) {
			index = skipWhitespace(text, index);
			let container = stack.at(-1);
			if (container === undefined) {
				if (index < text.length) return issue(index, "Unexpected content after the value");
				return null;
			}
			let char = text[index];
			let close = container === "array" ? "]" : "}";
			if (char === close) {
				stack.pop();
				index += 1;
				continue;
			}
			if (char !== ",") {
				return issue(
					index,
					container === "array"
						? "Expected ',' or ']' after an array element"
						: "Expected ',' or '}' after a property value",
				);
			}
			index = skipWhitespace(text, index + 1);
			if (container === "object") {
				if (text[index] !== '"') return issue(index, "Expected a double-quoted property name");
				let key = readMember(text, index);
				if ("reason" in key) return key;
				index = key.next;
			}
			break;
		}
	}
}

/** A value that ended at `next`, or a container it opened, whose contents come next. */
interface Read {
	next: number;
	opened: boolean;
}

/**
 * Reads one value at `index`. An opened container is pushed onto `stack` and answered with
 * `opened`, its first member's key already read; an empty container is a complete value.
 */
function readValue(text: string, index: number, stack: Container[]): Read | Issue {
	let char = text[index];
	if (char === undefined) return issue(index, "Unexpected end of input");
	if (char === "{") {
		let inner = skipWhitespace(text, index + 1);
		if (text[inner] === "}") return { next: inner + 1, opened: false };
		if (text[inner] !== '"') return issue(inner, "Expected a property name or '}'");
		let key = readMember(text, inner);
		if ("reason" in key) return key;
		stack.push("object");
		return { next: key.next, opened: true };
	}
	if (char === "[") {
		let inner = skipWhitespace(text, index + 1);
		if (text[inner] === "]") return { next: inner + 1, opened: false };
		stack.push("array");
		return { next: inner, opened: true };
	}
	if (char === '"') return complete(readString(text, index));
	if (char === "-" || isDigit(char)) return complete(readNumber(text, index));
	let literal = LITERALS[char];
	if (literal !== undefined) return complete(readLiteral(text, index, literal));
	return issue(index, `Unexpected character '${char}'`);
}

/** Reads `"key"` and its colon, answering the index where the member's value starts. */
function readMember(text: string, index: number): { next: number } | Issue {
	let end = readString(text, index);
	if (typeof end !== "number") return end;
	let colon = skipWhitespace(text, end);
	if (text[colon] !== ":") return issue(colon, "Expected ':' after a property name");
	return { next: skipWhitespace(text, colon + 1) };
}

/** The index just past the string at `index`, or the first character that breaks it. */
function readString(text: string, index: number): number | Issue {
	let position = index + 1;
	while (position < text.length) {
		let code = text.charCodeAt(position);
		if (code === 0x22) return position + 1;
		if (code < 0x20) return issue(position, "Control character in a string; escape it");
		if (code !== 0x5c) {
			position += 1;
			continue;
		}
		let escape = text[position + 1];
		if (escape === undefined) return issue(text.length, "Unexpected end of input");
		if (escape === "u") {
			for (let digit = position + 2; digit < position + 6; digit += 1) {
				if (!isHexDigit(text[digit])) return issue(digit, "Invalid Unicode escape in a string");
			}
			position += 6;
		} else if (SIMPLE_ESCAPES.has(escape)) {
			position += 2;
		} else {
			return issue(position + 1, "Invalid escape sequence in a string");
		}
	}
	return issue(text.length, "Unterminated string");
}

/** The index just past the number at `index`, following JSON's number grammar exactly. */
function readNumber(text: string, index: number): number | Issue {
	let position = index;
	if (text[position] === "-") {
		position += 1;
		if (!isDigit(text[position])) return issue(position, "Expected a digit after the minus sign");
	}
	if (text[position] === "0") {
		position += 1;
		if (isDigit(text[position])) return issue(position, "Leading zeros are not allowed");
	} else {
		position = digitsEnd(text, position);
	}
	if (text[position] === ".") {
		position += 1;
		if (!isDigit(text[position])) {
			return issue(position, "Expected a digit after the decimal point");
		}
		position = digitsEnd(text, position);
	}
	if (text[position] === "e" || text[position] === "E") {
		position += 1;
		if (text[position] === "+" || text[position] === "-") position += 1;
		if (!isDigit(text[position])) return issue(position, "Expected a digit in the exponent");
		position = digitsEnd(text, position);
	}
	return position;
}

/** The index just past `literal` at `index`, or the first character that differs from it. */
function readLiteral(text: string, index: number, literal: string): number | Issue {
	for (let offset = 1; offset < literal.length; offset += 1) {
		let char = text[index + offset];
		if (char === undefined) return issue(index + offset, "Unexpected end of input");
		if (char !== literal[offset]) return issue(index + offset, `Unexpected character '${char}'`);
	}
	return index + literal.length;
}

function complete(end: number | Issue): Read | Issue {
	return typeof end === "number" ? { next: end, opened: false } : end;
}

function digitsEnd(text: string, index: number): number {
	let position = index;
	while (isDigit(text[position])) position += 1;
	return position;
}

function skipWhitespace(text: string, index: number): number {
	let position = index;
	while (isWhitespace(text[position])) position += 1;
	return position;
}

function isDigit(char: string | undefined): boolean {
	return char !== undefined && char >= "0" && char <= "9";
}

function isHexDigit(char: string | undefined): boolean {
	return char !== undefined && /^[0-9a-fA-F]$/.test(char);
}

function issue(offset: number, reason: string): Issue {
	return { offset, reason };
}
