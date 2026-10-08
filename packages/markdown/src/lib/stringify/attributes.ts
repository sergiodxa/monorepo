/**
 * Writes a node's attributes back as source: the `{% … %}` annotation that
 * decorates a block and the attribute list an element carries. Shorthands come
 * first in a fixed order, so a second pass over the output writes it identically.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../../index.js";

import { holdsVariable, isVariable } from "../attributes.js";

/** The spelling a `#id` or `.class` shorthand can carry; anything else writes as a pair. */
const NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** An object key written unquoted; a hyphenated one is quoted, the way a script would spell it. */
const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Writes an attribute list, `#id` and `.a .b` first so the order survives a round
 * trip: the parser reads shorthands where they sit and appends `class` last.
 *
 * @param attributes - The attributes to write
 * @param shorthands - Whether `#id` and `.class` may stand for the two keys
 * @returns The attribute list, empty when there is nothing to write
 * @example writeAttributes({ id: "install" }, true)
 */
export function writeAttributes(attributes: Markdown.Attributes, shorthands: boolean): string {
	let { id, class: classes } = attributes;
	let shortId = shorthands && typeof id === "string" && NAME.test(id) ? id : null;
	let shortClasses =
		shorthands && typeof classes === "string" && isClassList(classes) ? classes : null;
	let parts: string[] = [];

	if (shortId !== null) parts.push(`#${shortId}`);
	if (shortClasses !== null) {
		for (let name of shortClasses.trim().split(/\s+/)) parts.push(`.${name}`);
	}

	for (let [key, value] of Object.entries(attributes)) {
		if (key === "id" && shortId !== null) continue;
		if (key === "class" && shortClasses !== null) continue;
		parts.push(writePair(key, value));
	}

	return parts.join(" ");
}

/**
 * Writes the annotation a block carries, which a caller places on the block's
 * opening line or on the line above it.
 *
 * @param attributes - The block's attributes
 * @returns The annotation, or `null` when the block carries none
 * @example writeAnnotation({ class: "wide" })
 */
export function writeAnnotation(attributes: Markdown.Attributes): string | null {
	let body = writeAttributes(attributes, true);
	return body === "" ? null : `{% ${body} %}`;
}

/** A class attribute earns the `.a .b` spelling when every name in it can be written that way. */
function isClassList(value: string): boolean {
	let names = value.trim().split(/\s+/);
	return value.trim() !== "" && names.every((name) => NAME.test(name));
}

/** One `key="string"`, the bare key a `true` is written as, or `key={…}` for every other value. */
function writePair(key: string, value: Markdown.AttributeValue): string {
	if (value === true) return key;
	if (typeof value === "string") return `${key}=${writeString(value)}`;
	return `${key}=${writeBraced(value)}`;
}

/**
 * Writes a value as the braced expression the reader turns back into it — `{42}`,
 * `{$plan}`, `{[1, 2]}`, `{{ a: "b" }}` — which is also how a renderer shows a
 * value whose variables were never filled in.
 *
 * @param value - One attribute value
 * @returns The value's source spelling, braces included
 * @example writeBraced({ type: "variable", name: "plan", position }) // "{$plan}"
 */
export function writeBraced(value: Markdown.AttributeValue): string {
	return `{${writeExpression(value)}}`;
}

/**
 * The text an HTML attribute carries for a value: a structured value as JSON a script
 * can parse, and a value still holding a variable as the braced spelling the source
 * used, so an unfilled hole shows rather than vanishing.
 *
 * @param value - One attribute value other than a boolean or `null`, which have no text
 * @returns The attribute's text
 */
export function attributeText(value: Exclude<Markdown.AttributeValue, boolean | null>): string {
	if (holdsVariable(value)) return writeBraced(value);
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/** The expression inside the braces, nested values written the same way. */
function writeExpression(value: Markdown.AttributeValue): string {
	if (typeof value === "string") return writeString(value);
	if (value === null || typeof value !== "object") return String(value);
	if (Array.isArray(value)) return `[${value.map(writeExpression).join(", ")}]`;
	if (isVariable(value)) return `$${value.name}`;

	let entries = Object.entries(value).map(
		([key, item]) => `${BARE_KEY.test(key) ? key : writeString(key)}: ${writeExpression(item)}`,
	);

	return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`;
}

/** A double-quoted string, its backslashes and quotes escaped the way the reader resolves them. */
function writeString(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
