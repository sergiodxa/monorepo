/**
 * Reads and writes RFC 6350 vCard 4.0 text: unfolds and folds content lines, decodes and
 * encodes parameters (with RFC 6868 caret escapes) and TEXT escapes, and moves dates between
 * vCard's basic format and the extended one the in-memory card keeps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { VCardParseError } from "../errors.js";

import type { VCard, VCardProperty, VCardValue } from "./model.js";

import { DEFAULT_TYPES, LISTS, STRUCTURED } from "./model.js";

/** The value types whose text carries vCard escapes and component separators. */
const TEXT_TYPES = new Set(["text"]);

/** The temporal value types, written in basic format in vCard and extended format in jCard. */
const TEMPORAL = new Set(["date", "time", "date-time", "date-and-or-time", "timestamp"]);

/** Parameters whose quoted value is still a comma-separated list. */
const QUOTED_LISTS = new Set(["type", "sort-as", "pid"]);

/** Parameters always written quoted, since their values are structured. */
const ALWAYS_QUOTED = new Set(["jscomps", "jsptr"]);

/** What each RFC 6868 caret escape stands for. */
const CARET_ESCAPES: Record<string, string> = { n: "\n", "'": '"', "^": "^" };

/** The longest line, in octets, before a fold. */
const LINE_OCTETS = 75;

/**
 * Splits text on a separator that is not escaped with a backslash.
 *
 * @param text - The text
 * @param separator - One character
 * @returns The pieces, still escaped
 */
export function splitEscaped(text: string, separator: string): string[] {
	let pieces: string[] = [];
	let current = "";
	for (let index = 0; index < text.length; index++) {
		let character = text[index] as string;
		if (character === "\\" && index + 1 < text.length) {
			current += character + (text[index + 1] as string);
			index++;
		} else if (character === separator) {
			pieces.push(current);
			current = "";
		} else {
			current += character;
		}
	}
	pieces.push(current);
	return pieces;
}

/** Decodes the TEXT escapes `\n`, `\,`, `\;` and `\\`. */
export function unescapeText(text: string): string {
	return text.replace(/\\(.)/g, (_, character: string) =>
		character === "n" || character === "N" ? "\n" : character,
	);
}

/** Encodes a TEXT value, escaping the separators a component or list value would split on. */
export function escapeText(text: string): string {
	return text.replace(/[\\,;]/g, (character) => `\\${character}`).replace(/\r?\n/g, "\\n");
}

/** Decodes RFC 6868 caret escapes in a parameter value. */
function decodeCaret(value: string): string {
	return value.replace(/\^([n^'])/g, (_, character: string) => CARET_ESCAPES[character] ?? "^");
}

/** Encodes a parameter value with RFC 6868 caret escapes. */
function encodeCaret(value: string): string {
	return value.replace(/\^/g, "^^").replace(/\r?\n/g, "^n").replace(/"/g, "^'");
}

/** The position of the first `:` outside a quoted parameter value, where the value starts. */
function valueStart(line: string): number {
	let quoted = false;
	for (let index = 0; index < line.length; index++) {
		let character = line[index];
		if (character === '"') quoted = !quoted;
		else if (character === ":" && !quoted) return index;
	}
	return -1;
}

/** Splits text on a separator outside double quotes, keeping the quotes. */
function splitUnquoted(text: string, separator: string): string[] {
	let pieces: string[] = [];
	let current = "";
	let quoted = false;
	for (let character of text) {
		if (character === '"') quoted = !quoted;
		if (character === separator && !quoted) {
			pieces.push(current);
			current = "";
		} else {
			current += character;
		}
	}
	pieces.push(current);
	return pieces;
}

/** One parameter's values: unquoted, caret-decoded and, for a list parameter, split on commas. */
function parameterValue(name: string, raw: string): string[] {
	let items = splitUnquoted(raw, ",").map((item) => {
		let quoted = item.length >= 2 && item.startsWith('"') && item.endsWith('"');
		return decodeCaret(quoted ? item.slice(1, -1) : item);
	});
	if (!QUOTED_LISTS.has(name)) return items;
	return items.flatMap((item) => item.split(","));
}

/**
 * Converts a basic-format vCard date or time to the extended format jCard writes:
 * `19850412` becomes `1985-04-12`, `232050+0400` becomes `23:20:50+04:00`.
 *
 * @param type - The value type
 * @param value - The vCard value
 * @returns The extended form
 */
export function toExtended(type: string, value: string): string {
	if (type === "time") return extendedTime(value);
	let separator = value.indexOf("T");
	if (separator === -1)
		return type === "date" || type === "date-and-or-time" ? extendedDate(value) : value;
	let date = value.slice(0, separator);
	let time = value.slice(separator + 1);
	return `${date === "" ? "" : extendedDate(date)}T${extendedTime(time)}`;
}

/** `19850412` → `1985-04-12`, `--0412` → `--04-12`; other forms are already extended. */
function extendedDate(value: string): string {
	let complete = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
	if (complete) return `${complete[1]}-${complete[2]}-${complete[3]}`;
	let truncated = /^--(\d{2})(\d{2})$/.exec(value);
	if (truncated) return `--${truncated[1]}-${truncated[2]}`;
	return value;
}

/** `232050` → `23:20:50`, `-2050` → `-20:50`, with the zone `+0400` → `+04:00`. */
function extendedTime(value: string): string {
	let match = /^(-{0,2})(\d+)(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(value);
	if (!match) return value;
	let [, dashes = "", digits = "", zone = ""] = match;
	let pairs = digits.match(/\d{2}/g) ?? [digits];
	let offset = /^([+-]\d{2})(\d{2})$/.exec(zone);
	return `${dashes}${pairs.join(":")}${offset ? `${offset[1]}:${offset[2]}` : zone}`;
}

/**
 * Converts an extended-format date or time back to vCard's basic format.
 *
 * @param value - The jCard value, e.g. `1985-04-12T23:20:50Z`
 * @returns The basic form, e.g. `19850412T232050Z`
 */
export function toBasic(value: string): string {
	let separator = value.indexOf("T");
	let date = separator === -1 ? value : value.slice(0, separator);
	let time = separator === -1 ? null : value.slice(separator + 1);
	let basicDate =
		/^\d{4}-\d{2}-\d{2}$/.test(date) || /^--\d{2}-\d{2}$/.test(date)
			? date.replace(/(\d)-(\d)/g, "$1$2")
			: date;
	if (time === null) return basicDate;
	return `${basicDate}T${time.replace(/(\d):(\d)/g, "$1$2")}`;
}

/** The value of one property line, decoded by its type and structure. */
function decodeValue(name: string, type: string, raw: string): VCardValue[] {
	if (TEXT_TYPES.has(type) && STRUCTURED.has(name)) {
		let components = splitEscaped(raw, ";").map((component) => {
			let values = splitEscaped(component, ",").map(unescapeText);
			return values.length === 1 ? (values[0] as string) : values;
		});
		if (name !== "n" && name !== "adr" && components.length === 1)
			return [components[0] as VCardValue];
		return [components];
	}
	if (TEXT_TYPES.has(type) && LISTS.has(name)) return splitEscaped(raw, ",").map(unescapeText);
	if (TEXT_TYPES.has(type)) return [unescapeText(raw)];
	if (TEMPORAL.has(type)) return splitEscaped(raw, ",").map((value) => toExtended(type, value));
	if (type === "utc-offset") return [raw.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")];
	if (type === "boolean") return [raw.toLowerCase() === "true"];
	if (type === "integer" || type === "float") {
		return splitEscaped(raw, ",").map((value) =>
			Number.isFinite(Number(value)) ? Number(value) : value,
		);
	}
	return [raw];
}

/** Parses one unfolded content line into a property. */
function contentLine(line: string, number: number): Result<VCardProperty, VCardParseError> {
	let colon = valueStart(line);
	if (colon === -1)
		return failure(new VCardParseError(`Line ${number} has no ":" before its value`, number));
	let [head = "", ...parameterParts] = splitUnquoted(line.slice(0, colon), ";");
	let dot = head.indexOf(".");
	let group = dot === -1 ? null : head.slice(0, dot);
	let name = (dot === -1 ? head : head.slice(dot + 1)).toLowerCase();
	if (!/^[a-z0-9-]+$/.test(name)) {
		return failure(new VCardParseError(`Line ${number} has an invalid property name`, number));
	}

	let parameters: Record<string, string | string[]> = {};
	let type: string | undefined;
	for (let part of parameterParts) {
		let equals = part.indexOf("=");
		let key = (equals === -1 ? part : part.slice(0, equals)).toLowerCase();
		let values = equals === -1 ? [""] : parameterValue(key, part.slice(equals + 1));
		if (key === "value") {
			type = (values[0] ?? "").toLowerCase();
			continue;
		}
		let previous = parameters[key];
		let merged =
			previous === undefined
				? values
				: [...(Array.isArray(previous) ? previous : [previous]), ...values];
		parameters[key] = merged.length === 1 ? (merged[0] as string) : merged;
	}
	if (group !== null) parameters.group = group;

	let valueType = type ?? DEFAULT_TYPES[name] ?? "unknown";
	return success({
		name,
		parameters,
		type: valueType,
		values: decodeValue(name, valueType, line.slice(colon + 1)),
	});
}

/**
 * Reads vCard text, which may hold several cards. Folded lines are unfolded, names and
 * parameter names lowercased, and values decoded by their type into the jCard shape.
 *
 * @param text - A `text/vcard` body
 * @returns The cards in order, or the first line that does not parse
 * @example parseVCard("BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Joe\r\nEND:VCARD\r\n");
 */
export function parseVCard(text: string): Result<VCard[], VCardParseError> {
	let lines = text.replace(/\r\n|\r/g, "\n").split("\n");
	let unfolded: Array<{ line: string; number: number }> = [];
	for (let [index, line] of lines.entries()) {
		let previous = unfolded.at(-1);
		if ((line.startsWith(" ") || line.startsWith("\t")) && previous) previous.line += line.slice(1);
		else if (line !== "") unfolded.push({ line, number: index + 1 });
	}

	let cards: VCard[] = [];
	let current: VCard | null = null;
	for (let { line, number } of unfolded) {
		let upper = line.toUpperCase();
		if (upper === "BEGIN:VCARD") {
			if (current !== null)
				return failure(new VCardParseError(`Line ${number} nests a vCard`, number));
			current = { properties: [] };
			continue;
		}
		if (upper === "END:VCARD") {
			if (current === null)
				return failure(new VCardParseError(`Line ${number} ends no vCard`, number));
			cards.push(current);
			current = null;
			continue;
		}
		if (current === null)
			return failure(new VCardParseError(`Line ${number} is outside BEGIN:VCARD`, number));
		let property = contentLine(line, number);
		if (property.status === "failure") return property;
		current.properties.push(property.data);
	}
	if (current !== null) return failure(new VCardParseError("The text ends before END:VCARD"));
	return success(cards);
}

/** One parameter value for a content line: caret-encoded, and quoted when it holds `:`, `;` or `,`. */
function encodeParameterValue(name: string, value: string): string {
	let encoded = encodeCaret(value);
	return ALWAYS_QUOTED.has(name) || /[:;,"]/.test(value) ? `"${encoded}"` : encoded;
}

/** The text of one value, encoded by its type and structure. */
function encodeValue(property: VCardProperty): string {
	let { name, type, values } = property;
	let text = (value: VCardValue): string => {
		if (Array.isArray(value)) return value.map(text).join(",");
		if (value === null) return "";
		if (typeof value !== "string") return String(value);
		if (TEXT_TYPES.has(type)) return escapeText(value);
		if (TEMPORAL.has(type)) return toBasic(value);
		if (type === "utc-offset") return value.replace(":", "");
		return value;
	};
	if (TEXT_TYPES.has(type) && STRUCTURED.has(name)) {
		let [first] = values;
		let components = Array.isArray(first) ? first : [first ?? ""];
		return components.map(text).join(";");
	}
	return values.map(text).join(",");
}

/** Folds a content line at 75 octets without splitting a UTF-8 sequence. */
function fold(line: string): string {
	let encoder = new TextEncoder();
	let output = "";
	let octets = 0;
	for (let character of line) {
		let size = encoder.encode(character).length;
		if (octets + size > LINE_OCTETS) {
			output += "\r\n ";
			octets = 1;
		}
		output += character;
		octets += size;
	}
	return output;
}

/**
 * Writes one property as a content line, `VALUE` added only when the type is not the
 * property's default.
 */
function propertyLine(property: VCardProperty): string {
	let { group, ...parameters } = property.parameters;
	let head = `${typeof group === "string" ? `${group}.` : ""}${property.name.toUpperCase()}`;
	let parts = [head];
	let defaultType = DEFAULT_TYPES[property.name] ?? "unknown";
	if (property.type !== defaultType && property.type !== "unknown")
		parts.push(`VALUE=${property.type}`);
	for (let [name, value] of Object.entries(parameters)) {
		let values = Array.isArray(value) ? value : [value];
		parts.push(
			`${name.toUpperCase()}=${values.map((item) => encodeParameterValue(name, item)).join(",")}`,
		);
	}
	return fold(`${parts.join(";")}:${encodeValue(property)}`);
}

/**
 * Writes cards as vCard 4.0 text with CRLF line endings, `VERSION:4.0` right after each
 * `BEGIN:VCARD`.
 *
 * @param cards - One card or several
 * @returns The `text/vcard` body
 */
export function stringifyVCard(cards: VCard | VCard[]): string {
	let list = Array.isArray(cards) ? cards : [cards];
	return list
		.map((card) => {
			let lines = card.properties
				.filter((property) => property.name !== "version")
				.map(propertyLine);
			return ["BEGIN:VCARD", "VERSION:4.0", ...lines, "END:VCARD", ""].join("\r\n");
		})
		.join("");
}
