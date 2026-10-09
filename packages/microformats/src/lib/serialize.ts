/**
 * Writes an element's content back as markup, following the HTML fragment
 * serialization algorithm, with every URL attribute resolved against the page, so an
 * `e-*` value keeps working once it is shown somewhere other than where it was written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMElement, DOMNode } from "@sdxc/html/document";

import { ELEMENT_NODE, TEXT_NODE, tagName, trimSpaces } from "./tree.js";
import { resolveUrl } from "./url.js";

/** Comment nodes, which serialize as themselves. */
const COMMENT_NODE = 8;

/** Elements serialized without an end tag or content. */
const VOID_TAGS = new Set([
	"area",
	"base",
	"basefont",
	"bgsound",
	"br",
	"col",
	"embed",
	"frame",
	"hr",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

/** Elements whose text children serialize verbatim. */
const RAW_TEXT_TAGS = new Set([
	"iframe",
	"noembed",
	"noframes",
	"noscript",
	"plaintext",
	"script",
	"style",
	"xmp",
]);

/** Attributes holding one URL, resolved unless the value is a same-document fragment. */
const URL_ATTRIBUTES = new Set([
	"action",
	"background",
	"cite",
	"data",
	"formaction",
	"href",
	"longdesc",
	"poster",
	"src",
]);

/**
 * The element's inner HTML with its URL attributes absolute and the ends trimmed.
 *
 * @param element - The `e-*` property element
 * @param base - What relative URLs resolve against
 */
export function innerHTML(element: DOMElement, base: string): string {
	return trimSpaces(serializeChildren(element, base, false));
}

/** Serializes each child node in order. */
function serializeChildren(node: DOMNode, base: string, raw: boolean): string {
	let html = "";
	for (let child of Array.from(node.childNodes)) {
		if (child.nodeType === TEXT_NODE) {
			let text = child.nodeValue ?? "";
			html += raw ? text : escapeText(text);
		} else if (child.nodeType === COMMENT_NODE) {
			html += `<!--${child.nodeValue ?? ""}-->`;
		} else if (child.nodeType === ELEMENT_NODE) {
			html += serializeElement(child as DOMElement, base);
		}
	}
	return html;
}

/** One element with its attributes, content and end tag. */
function serializeElement(element: DOMElement, base: string): string {
	let tag = tagName(element);
	let html = `<${tag}`;
	for (let attribute of Array.from(element.attributes)) {
		let value = attribute.value;
		if (URL_ATTRIBUTES.has(attribute.name) && !value.startsWith("#")) {
			value = resolveUrl(value, base);
		} else if (attribute.name === "srcset") {
			value = resolveSrcset(value, base);
		}
		html += ` ${attribute.name}="${escapeAttribute(value)}"`;
	}
	html += ">";
	if (VOID_TAGS.has(tag)) return html;
	return `${html}${serializeChildren(element, base, RAW_TEXT_TAGS.has(tag))}</${tag}>`;
}

/** Resolves each candidate URL of a `srcset`, keeping its descriptor. */
function resolveSrcset(value: string, base: string): string {
	return value
		.split(",")
		.map((candidate) => {
			let [url = "", ...descriptors] = candidate.trim().split(/\s+/u);
			return [resolveUrl(url, base), ...descriptors].join(" ");
		})
		.join(", ");
}

/** Escapes text content the way the fragment serialization algorithm does. */
function escapeText(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll(" ", "&nbsp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

/** Escapes an attribute value the way the fragment serialization algorithm does. */
function escapeAttribute(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll(" ", "&nbsp;").replaceAll('"', "&quot;");
}
