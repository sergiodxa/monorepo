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

/** What {@link scanAnnotation} found, so a caller can both read and skip the annotation. */
export interface Annotation {
	/** The text between `{%` and `%}`, trimmed. */
	body: string;
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
			return { body: text.slice(start + 2, index).trim(), end: index + 2 };
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
 * @returns The variable's name, or `null` when the body is an attribute list
 */
export function readVariableName(body: string): string | null {
	if (!body.startsWith("$")) return null;

	let name = NAME.exec(body.slice(1))?.[0];
	if (!name) return null;

	return body.slice(1 + name.length).trim() === "" ? name : null;
}

/** What {@link scanTagOpen} found at an opening tag, whether or not the name is registered. */
export interface TagOpen {
	name: string;
	/** The attribute text between the name and the closing `>`. */
	attributeText: string;
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
 * Reads a whitespace-separated attribute list into literal values. Shorthands are
 * an annotation's alone: an element writes `id` and `class` as ordinary attributes,
 * which is what an author reading the raw file expects of it.
 *
 * @param text - The attribute list, without its delimiters
 * @param shorthands - Whether `#id` and `.class` are allowed
 * @returns The attributes, or what stopped the read and where
 * @example parseAttributeList('type="warning"', false)
 */
export function parseAttributeList(
	text: string,
	shorthands: boolean,
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

		let value = readValue(text, index);
		if (!value) {
			return failure(new AttributeError(`Expected a value for "${key}"`, index));
		}

		attributes[key] = value.value;
		index = value.end;
	}

	if (classes.length > 0) attributes.class = classes.join(" ");

	return success(attributes);
}

/** One literal attribute value and where it ends, or `null` when the text holds no literal. */
function readValue(
	text: string,
	start: number,
): { value: string | number | boolean; end: number } | null {
	let char = text[start];

	if (char === '"' || char === "'") return readQuoted(text, start, char);
	if (char === "{") return readBraced(text, start);

	return null;
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

/** A braced literal: a number or a boolean, which are the values an author can write without quotes. */
function readBraced(text: string, start: number): { value: number | boolean; end: number } | null {
	let close = text.indexOf("}", start + 1);
	if (close === -1) return null;

	let raw = text.slice(start + 1, close).trim();

	if (raw === "true") return { value: true, end: close + 1 };
	if (raw === "false") return { value: false, end: close + 1 };

	if (/^-?\d+(?:\.\d+)?$/.test(raw)) return { value: Number(raw), end: close + 1 };

	return null;
}
