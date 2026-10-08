/**
 * The dialect's two extra syntaxes, scanned and read in one place: the `{% … %}`
 * annotation that decorates a block and the `<name …>` element that creates one.
 * Both phases read tags and annotations, so both ask these functions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Markdown } from "../index.js";

/** The name a tag or an attribute may take: an identifier, hyphens allowed after the first character. */
const NAME = /^[A-Za-z_][A-Za-z0-9_-]*/;

/**
 * What follows a variable's `$`: a name, then dotted segments that are names or array
 * indexes. Data access is all it spells, so a value never runs code while it is filled in.
 */
const PATH = /^[A-Za-z_][A-Za-z0-9_-]*(?:\.(?:[A-Za-z_][A-Za-z0-9_-]*|\d+))*(?![.A-Za-z0-9_-])/;

/** The three bare words a braced value may hold, each ending where a name could not continue. */
const KEYWORD = /^(?:true|false|null)(?![A-Za-z0-9_-])/;

/** A decimal number, sign and fraction optional, as JSON spells one without the exponent. */
const NUMBER = /^-?\d+(?:\.\d+)?/;

/** What {@link scanAnnotation} found, so a caller can both read and skip the annotation. */
export interface Annotation {
	/** The text between `{%` and `%}`, trimmed. */
	body: string;
	/** Index of the body's first character, so a value inside it can be located. */
	bodyStart: number;
	/** Index one past the closing `%}`. */
	end: number;
}

/**
 * Finds the annotation opening at `start`, respecting quoted strings so a `%}`
 * written inside an attribute value does not close it early.
 *
 * @param text - The text to scan
 * @param start - Index of the `{` that opens `{%`
 * @returns The annotation's body and where it ends, or `null` when nothing closes it
 */
export function scanAnnotation(text: string, start: number): Annotation | null {
	if (text.slice(start, start + 2) !== "{%") return null;

	let index = start + 2;
	let quote: string | null = null;

	while (index < text.length) {
		let char = text[index];

		if (quote) {
			if (char === "\\") index += 2;
			else {
				if (char === quote) quote = null;
				index += 1;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			index += 1;
			continue;
		}

		if (char === "%" && text[index + 1] === "}") {
			let raw = text.slice(start + 2, index);
			let lead = raw.length - raw.trimStart().length;
			return { body: raw.trim(), bodyStart: start + 2 + lead, end: index + 2 };
		}

		index += 1;
	}

	return null;
}

/**
 * Reads an annotation body as a variable reference. The `$` is what tells a
 * variable from an attribute list at the first character, since a bare `wide`
 * there is the boolean attribute `wide`.
 *
 * @param body - The text between `{%` and `%}`, already trimmed
 * @returns The variable's dotted path as written, or `null` when the body is an attribute list
 */
export function readVariableName(body: string): string | null {
	if (!body.startsWith("$")) return null;

	let name = PATH.exec(body.slice(1))?.[0];
	if (!name) return null;

	return body.slice(1 + name.length).trim() === "" ? name : null;
}

/** What {@link scanTagOpen} found at an opening tag, whether or not the name is registered. */
export interface TagOpen {
	name: string;
	/** The attribute text between the name and the closing `>`. */
	attributeText: string;
	/** Index of the attribute text's first character, so a value inside it can be located. */
	attributeStart: number;
	selfClosing: boolean;
	/** Index one past the `>`. */
	end: number;
}

/**
 * Finds an opening element at `start`, respecting quoted attribute values so a
 * `>` written inside one does not close the tag early.
 *
 * @param text - The text to scan
 * @param start - Index of the `<`
 * @returns The element's name, attributes and where it ends, or `null` when it is not one
 */
export function scanTagOpen(text: string, start: number): TagOpen | null {
	if (text[start] !== "<") return null;

	let name = NAME.exec(text.slice(start + 1))?.[0];
	if (!name) return null;

	let index = start + 1 + name.length;
	let quote: string | null = null;

	while (index < text.length) {
		let char = text[index];

		if (quote) {
			if (char === quote) quote = null;
			index += 1;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			index += 1;
			continue;
		}

		if (char === ">") {
			let raw = text.slice(start + 1 + name.length, index);
			let selfClosing = raw.trimEnd().endsWith("/");
			return {
				name,
				attributeText: selfClosing ? raw.trimEnd().slice(0, -1) : raw,
				attributeStart: start + 1 + name.length,
				selfClosing,
				end: index + 1,
			};
		}

		index += 1;
	}

	return null;
}

/** What {@link scanTagClose} found at a closing tag. */
export interface TagClose {
	name: string;
	/** Index one past the `>`. */
	end: number;
}

/**
 * @param text - The text to scan
 * @param start - Index of the `<` that opens `</`
 * @returns The closing element's name and where it ends, or `null` when it is not one
 */
export function scanTagClose(text: string, start: number): TagClose | null {
	if (text.slice(start, start + 2) !== "</") return null;

	let name = NAME.exec(text.slice(start + 2))?.[0];
	if (!name) return null;

	let index = start + 2 + name.length;
	while (index < text.length && /\s/.test(text[index] ?? "")) index += 1;

	if (text[index] !== ">") return null;

	return { name, end: index + 1 };
}

/** Reports what could not be read, so the caller can attach the position it already knows. */
export class AttributeError extends Error {
	override name = "AttributeError";

	/** Index inside the text that was handed in, for a caller that maps it back to the source. */
	index: number;

	/**
	 * @param message - What stopped the read
	 * @param index - Where in the handed-in text it stopped
	 */
	constructor(message: string, index: number) {
		super(message);
		this.index = index;
	}
}

/**
 * Maps a range inside the attribute text to where it sits in the source, which is
 * how a variable written in an attribute value gets the position every node carries.
 */
export interface Locate {
	(start: number, end: number): Markdown.Position;
}

/** Positions as if the attribute text were the whole source, for a caller with nothing to map. */
const LOCATE_IN_TEXT: Locate = (start, end) => ({
	start: { line: 1, column: start + 1, offset: start },
	end: { line: 1, column: end + 1, offset: end },
});

/**
 * Reads a whitespace-separated attribute list. Shorthands are an annotation's alone:
 * an element writes `id` and `class` as ordinary attributes, which is what an author
 * reading the raw file expects of it.
 *
 * @param text - The attribute list, without its delimiters
 * @param shorthands - Whether `#id` and `.class` are allowed
 * @param locate - Maps an index in `text` to the source, for the variables a value holds
 * @returns The attributes, or what stopped the read and where
 * @example parseAttributeList('type="warning"', false)
 */
export function parseAttributeList(
	text: string,
	shorthands: boolean,
	locate: Locate = LOCATE_IN_TEXT,
): Result<Markdown.Attributes, AttributeError> {
	let attributes: Markdown.Attributes = {};
	let classes: string[] = [];
	let index = 0;

	while (index < text.length) {
		if (/\s/.test(text[index] ?? "")) {
			index += 1;
			continue;
		}

		if (shorthands && (text[index] === "#" || text[index] === ".")) {
			let marker = text[index];
			let name = NAME.exec(text.slice(index + 1))?.[0];
			if (!name) {
				return failure(new AttributeError(`Expected a name after "${marker}"`, index));
			}

			if (marker === "#") attributes.id = name;
			else classes.push(name);

			index += 1 + name.length;
			continue;
		}

		let key = NAME.exec(text.slice(index))?.[0];
		if (!key) {
			return failure(new AttributeError("Expected an attribute name", index));
		}

		index += key.length;

		if (text[index] !== "=") {
			attributes[key] = true;
			continue;
		}

		index += 1;

		let value = readValue(text, index, locate);
		if (!value) {
			return failure(new AttributeError(`Expected a value for "${key}"`, index));
		}
		if ("error" in value) return failure(new AttributeError(value.error, index));

		attributes[key] = value.value;
		index = value.end;
	}

	if (classes.length > 0) attributes.class = classes.join(" ");

	return success(attributes);
}

/**
 * Whether a value holds a variable anywhere inside it, which is what decides that a
 * tag's schema waits until the variables are filled in.
 *
 * @param value - Attributes, or one value inside them
 * @returns Whether a variable node sits anywhere in it
 */
export function holdsVariable(value: Markdown.AttributeValue | Markdown.Attributes): boolean {
	if (value === null || typeof value !== "object") return false;
	if (isVariable(value)) return true;
	if (Array.isArray(value)) return value.some(holdsVariable);
	return Object.values(value).some(holdsVariable);
}

/**
 * Tells a variable node from an object literal. The reader refuses an object literal
 * whose `type` is `"variable"`, so this test never mistakes one for the other.
 *
 * @param value - One attribute value
 * @returns Whether it is a variable to fill in
 */
export function isVariable(value: Markdown.AttributeValue): value is Markdown.Variable {
	return (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		value.type === "variable"
	);
}

/** One value the reader finished, a reason it refused one, or `null` when nothing there reads as a value. */
type ValueRead = { value: Markdown.AttributeValue; end: number } | { error: string } | null;

/** A quoted string, or a braced expression — `{42}`, `{$name}`, `{[…]}`, `{{…}}`. */
function readValue(text: string, start: number, locate: Locate): ValueRead {
	let char = text[start];

	if (char === '"' || char === "'") return readQuoted(text, start, char);
	if (char !== "{") return null;

	let inner = readExpression(text, skipSpace(text, start + 1), locate);
	if (!inner || "error" in inner) return inner;

	let close = skipSpace(text, inner.end);
	if (text[close] !== "}") return null;

	return { value: inner.value, end: close + 1 };
}

/** A literal, a variable, or an array or object of them; calls and operators read as nothing. */
function readExpression(text: string, start: number, locate: Locate): ValueRead {
	let char = text[start];

	if (char === '"' || char === "'") return readQuoted(text, start, char);
	if (char === "[") return readArray(text, start, locate);
	if (char === "{") return readObject(text, start, locate);
	if (char === "$") return readVariable(text, start, locate);

	let word = KEYWORD.exec(text.slice(start))?.[0];
	if (word !== undefined) {
		let value = word === "true" ? true : word === "false" ? false : null;
		return { value, end: start + word.length };
	}

	let number = NUMBER.exec(text.slice(start))?.[0];
	if (number !== undefined) return { value: Number(number), end: start + number.length };

	return null;
}

/** `[a, b]`, a trailing comma allowed so a list written one entry per line edits cleanly. */
function readArray(text: string, start: number, locate: Locate): ValueRead {
	let items: Markdown.AttributeValue[] = [];
	let index = skipSpace(text, start + 1);

	while (text[index] !== "]") {
		let item = readExpression(text, index, locate);
		if (!item || "error" in item) return item;

		items.push(item.value);
		index = skipSpace(text, item.end);

		if (text[index] === ",") index = skipSpace(text, index + 1);
		else if (text[index] !== "]") return null;
	}

	return { value: items, end: index + 1 };
}

/**
 * `{ key: value }`, keys bare or quoted. Entries are defined rather than assigned, so
 * a `__proto__` key is an ordinary entry, and `type: "variable"` is refused because
 * that is what a variable node looks like.
 */
function readObject(text: string, start: number, locate: Locate): ValueRead {
	let entries: { [key: string]: Markdown.AttributeValue } = {};
	let index = skipSpace(text, start + 1);

	while (text[index] !== "}") {
		let char = text[index];
		let key: string;

		if (char === '"' || char === "'") {
			let quoted = readQuoted(text, index, char);
			if (!quoted) return null;
			key = quoted.value;
			index = quoted.end;
		} else {
			let name = NAME.exec(text.slice(index))?.[0];
			if (!name) return null;
			key = name;
			index += name.length;
		}

		index = skipSpace(text, index);
		if (text[index] !== ":") return null;

		let value = readExpression(text, skipSpace(text, index + 1), locate);
		if (!value || "error" in value) return value;

		Object.defineProperty(entries, key, {
			value: value.value,
			enumerable: true,
			writable: true,
			configurable: true,
		});
		index = skipSpace(text, value.end);

		if (text[index] === ",") index = skipSpace(text, index + 1);
		else if (text[index] !== "}") return null;
	}

	if (entries.type === "variable") {
		let name = typeof entries.name === "string" ? entries.name : "name";
		return { error: `"type": "variable" is reserved for variables, so write {$${name}} instead` };
	}

	return { value: entries, end: index + 1 };
}

/** `$name` or `$a.b.0`, located so a value that fails once filled in points back at it. */
function readVariable(text: string, start: number, locate: Locate): ValueRead {
	let name = PATH.exec(text.slice(start + 1))?.[0];
	if (!name) return null;

	let end = start + 1 + name.length;
	return { value: { type: "variable", name, position: locate(start, end) }, end };
}

/** A quoted string, with backslash escapes resolved so a quote can appear inside one. */
function readQuoted(
	text: string,
	start: number,
	quote: string,
): { value: string; end: number } | null {
	let out = "";
	let index = start + 1;

	while (index < text.length) {
		let char = text[index];

		if (char === "\\") {
			out += text[index + 1] ?? "";
			index += 2;
			continue;
		}

		if (char === quote) return { value: out, end: index + 1 };

		out += char;
		index += 1;
	}

	return null;
}

/** @returns The index of the first character at or after `index` that is not whitespace */
function skipSpace(text: string, index: number): number {
	let at = index;
	while (at < text.length && /\s/.test(text[at] ?? "")) at += 1;
	return at;
}
