/**
 * Writes a node's attributes back as source: the `{% … %}` annotation that
 * decorates a block and the attribute list an element carries. Shorthands come
 * first in a fixed order, so a second pass over the output writes it identically.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../../index.js";

/** The spelling a `#id` or `.class` shorthand can carry; anything else writes as a pair. */
const NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

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
	let id = attributes.id;
	let classes = attributes.class;
	let writesId = shorthands && typeof id === "string" && NAME.test(id);
	let writesClass = shorthands && typeof classes === "string" && isClassList(classes);
	let parts: string[] = [];

	if (writesId) parts.push(`#${String(id)}`);
	if (writesClass) for (let name of String(classes).trim().split(/\s+/)) parts.push(`.${name}`);

	for (let [key, value] of Object.entries(attributes)) {
		if (key === "id" && writesId) continue;
		if (key === "class" && writesClass) continue;
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

/** One `key="string"`, `key={42}`, `key={false}`, or the bare key a `true` is written as. */
function writePair(key: string, value: string | number | boolean): string {
	if (value === true) return key;
	if (typeof value === "boolean" || typeof value === "number") return `${key}={${String(value)}}`;
	return `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
