/**
 * The `textContent` reads the parsing specification defines: script and style dropped,
 * images standing in for themselves by their `alt` (and, for `p-*` and `e-*` values,
 * by their `src`), and HTML spaces trimmed from the ends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMElement, DOMNode } from "@sdxc/html/document";

import { ELEMENT_NODE, TEXT_NODE, tagName, trimSpaces } from "./tree.js";
import { resolveUrl } from "./url.js";

/** Elements whose text every value leaves out. */
const DROPPED_TAGS = new Set(["script", "style", "template"]);

/**
 * How a nested `<img>` reads: absent, by its `alt` alone (the implied name), or by its
 * `alt` falling back to its resolved `src` padded with spaces (`p-*` and `e-*` values).
 */
export type ImageText = "none" | "alt" | "alt-or-src";

/**
 * The trimmed text of an element's descendants.
 *
 * @param element - The element whose content is read; its own tag never matters
 * @param images - How nested images contribute
 * @param base - What a nested image's `src` resolves against
 */
export function textOf(element: DOMElement, images: ImageText, base: string): string {
	return trimSpaces(collect(element, images, base));
}

/** Concatenates the text a node contributes, recursing through elements. */
function collect(node: DOMNode, images: ImageText, base: string): string {
	let text = "";
	for (let child of Array.from(node.childNodes)) {
		if (child.nodeType === TEXT_NODE) {
			text += child.nodeValue ?? "";
			continue;
		}
		if (child.nodeType !== ELEMENT_NODE) continue;
		let element = child as DOMElement;
		let tag = tagName(element);
		if (DROPPED_TAGS.has(tag)) continue;
		if (tag === "img") {
			text += imageText(element, images, base);
			continue;
		}
		text += collect(element, images, base);
	}
	return text;
}

/** What one nested image contributes under the given rule. */
function imageText(image: DOMElement, images: ImageText, base: string): string {
	if (images === "none") return "";
	let alt = image.getAttribute("alt");
	if (alt !== null) return alt;
	if (images === "alt") return "";
	let src = image.getAttribute("src");
	if (src === null) return "";
	return ` ${resolveUrl(src, base)} `;
}
