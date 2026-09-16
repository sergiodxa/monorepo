/**
 * Writes the chosen subtree back out as markup, leaving the furniture inside it
 * behind. What it emits is the publisher's own spelling and is treated as such: it
 * is handed to the sanitizer before anything renders it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMElement, DOMNode } from "@sdxc/html/document";

import { isFurniture } from "./score.js";

/** What a tree calls an element, and what it calls a run of text. */
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Elements that close themselves, so a serializer never writes an end tag for one. */
const VOID_TAGS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr",
]);

/**
 * The markup of an element's own subtree, with the comment threads, share rails,
 * related-post blocks and navigation inside it dropped along with their contents.
 *
 * @param element - The container the article was found in.
 */
export function serialize(element: DOMElement): string {
	return Array.from(element.childNodes).map(node).join("");
}

/** One node's markup, which is nothing for a node a reader never sees. */
function node(source: DOMNode): string {
	if (source.nodeType === TEXT_NODE) return escapeText(source.nodeValue ?? "");
	if (source.nodeType !== ELEMENT_NODE) return "";

	let element = source as DOMElement;
	if (isFurniture(element)) return "";

	let tag = element.localName.toLowerCase();
	let attributes = Array.from(element.attributes)
		.map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
		.join("");

	if (VOID_TAGS.has(tag)) return `<${tag}${attributes}>`;

	return `<${tag}${attributes}>${serialize(element)}</${tag}>`;
}

/** Text as markup spells it, so a body quoting a tag is read as the words it wrote. */
function escapeText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** An attribute value as markup spells it, inside the double quotes it is written in. */
function escapeAttribute(value: string): string {
	return escapeText(value).replaceAll('"', "&quot;");
}
