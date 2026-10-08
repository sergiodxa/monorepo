/**
 * The HTML elements a document may opt into rendering as elements, with where each
 * one stands and what it holds, plus the attribute and URL rules every allowlisted
 * element is held to. The parser and every renderer read the same table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "../index.js";

/**
 * Where an element stands and what it holds. A `block` element alone on its line
 * holds markdown blocks, and its text when written whole on one line; an `inline`
 * element is phrasing content wherever it is written; a `void` one holds nothing.
 */
export interface ElementShape {
	level: "block" | "inline";
	content: "blocks" | "inline" | "none";
}

/** Block-level elements holding markdown blocks, or their text when written whole on one line. */
const CONTAINERS = [
	"address",
	"article",
	"aside",
	"center",
	"details",
	"dd",
	"div",
	"dl",
	"figure",
	"footer",
	"header",
	"main",
	"nav",
	"section",
] as const;

/** Block-level elements holding a line of inline content, like a disclosure's summary. */
const CAPTIONS = ["dt", "figcaption", "summary"] as const;

/** Phrasing elements, inline wherever they are written. */
const PHRASING = [
	"a",
	"abbr",
	"b",
	"bdi",
	"bdo",
	"cite",
	"code",
	"data",
	"del",
	"dfn",
	"em",
	"i",
	"ins",
	"kbd",
	"mark",
	"q",
	"s",
	"samp",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"time",
	"u",
	"var",
] as const;

/** Void elements; `hr` alone stands as a block. */
const VOIDS = ["hr", "br", "img", "wbr"] as const;

/**
 * Every element the allowlist accepts. Elements markdown already spells (`p`, `h1`,
 * `ul`, `table`, `pre`) and those whose body is raw text or script are absent, so
 * opting in never trades a markdown construct for an unparsed one.
 */
export type HtmlElementName = (
	| typeof CONTAINERS
	| typeof CAPTIONS
	| typeof PHRASING
	| typeof VOIDS
)[number];

/**
 * Where an element stands and what it holds.
 *
 * @param name - An element name, as the source or a hand-built tree wrote it
 * @returns Its shape, or `undefined` for a name the allowlist does not accept
 */
export function elementShape(name: string): ElementShape | undefined {
	if (includes(CONTAINERS, name)) return { level: "block", content: "blocks" };
	if (includes(CAPTIONS, name)) return { level: "block", content: "inline" };
	if (includes(PHRASING, name)) return { level: "inline", content: "inline" };
	if (includes(VOIDS, name)) return { level: name === "hr" ? "block" : "inline", content: "none" };
	return undefined;
}

/** `Array.prototype.includes` over a literal tuple, taking any string as the needle. */
function includes(list: readonly string[], name: string): boolean {
	return list.includes(name);
}

/** The attributes whose value is a URL a browser follows or fetches. */
const URL_ATTRIBUTES = new Set(["href", "src", "cite", "action", "formaction", "poster"]);

/** The schemes a URL attribute may name; a value with no scheme is relative and always allowed. */
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** A leading `scheme:`, read the way a browser does once it has dropped control characters and spaces. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Whether an element may carry an attribute. An event handler never may, whatever
 * the allowlist says, because its value is script.
 *
 * @param allowed - The attributes the allowlist names for this element
 * @param name - The attribute the source wrote
 * @returns Whether the attribute may stay on the element
 */
export function allowsAttribute(allowed: ReadonlySet<string>, name: string): boolean {
	return allowed.has(name) && !/^on/i.test(name);
}

/**
 * Whether an attribute value is safe to hand a browser: anything outside a URL
 * attribute is, and a URL is when it is relative or names an allowed scheme.
 *
 * @param name - The attribute's name
 * @param value - Its value
 * @returns Whether a renderer may write the value
 * @example isSafeAttributeValue("href", "javascript:alert(1)") // false
 */
export function isSafeAttributeValue(name: string, value: unknown): boolean {
	if (!URL_ATTRIBUTES.has(name.toLowerCase()) || typeof value !== "string") return true;

	let visible = "";
	for (let index = 0; index < value.length; index++) {
		if (value.charCodeAt(index) > 0x20) visible += value.charAt(index);
	}

	let scheme = SCHEME.exec(visible)?.[1];
	return scheme === undefined || SAFE_SCHEMES.has(scheme.toLowerCase());
}

/** Block types no inline slot holds; `tag`, `element` and `comment` stand in either. */
const BLOCK_ONLY = new Set<string>([
	"heading",
	"paragraph",
	"code",
	"list",
	"listItem",
	"blockquote",
	"alert",
	"table",
	"tableRow",
	"tableCell",
	"thematicBreak",
	"html",
	"footnoteDefinition",
]);

/**
 * Whether a tag's or element's children are blocks. The first child that says so
 * decides: a comment or a tag stands in either column and is skipped, and an element
 * answers with its own level. Children that never say default to blocks.
 *
 * @param children - The children of a tag or an element
 * @returns Whether to write them as lines rather than as one run of text
 */
export function holdsBlocks(children: readonly Markdown.Node[]): boolean {
	for (let child of children) {
		if (child.type === "comment" || child.type === "tag") continue;
		if (child.type === "element") return elementShape(child.name)?.level === "block";
		return BLOCK_ONLY.has(child.type);
	}

	return true;
}
