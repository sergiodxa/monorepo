/**
 * Whitespace normalization and the visible-text walk every read shares, so a name
 * comparison and a text read collapse spacing the same way and an inline element
 * stays inside the sentence that holds it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isHidden, isNonRendered } from "./visibility.js";

/**
 * Elements a browser lays out in the text flow, whose boundaries therefore add no
 * spacing to the text around them.
 */
const INLINE_TAGS = new Set([
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
	"label",
	"mark",
	"output",
	"q",
	"rp",
	"rt",
	"ruby",
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
	"wbr",
]);

/** Node type of a text node, as `Node.TEXT_NODE` spells it. */
const TEXT_NODE = 3;

/** Node type of an element, as `Node.ELEMENT_NODE` spells it. */
const ELEMENT_NODE = 1;

/**
 * Collapses every run of whitespace — U+00A0 and the other Unicode spaces
 * included — into one ASCII space and trims the ends, which is the form every
 * name and text comparison in the package runs against.
 */
export function normalize(value: string): string {
	return value.replace(/\s+/gu, " ").trim();
}

/**
 * Reads the text a person would see inside an element, leaving out what markup
 * hides and separating block boundaries with a space so words never merge across
 * them.
 */
export function visibleText(node: Node | null | undefined): string {
	if (!node) return "";
	return normalize(collect(node));
}

/** Walks a subtree in document order, accumulating the text its children carry. */
function collect(node: Node): string {
	let text = "";

	for (let child of Array.from(node.childNodes)) {
		if (child.nodeType === TEXT_NODE) {
			text += child.nodeValue ?? "";
			continue;
		}

		if (child.nodeType !== ELEMENT_NODE) continue;

		let element = child as Element;
		let tag = element.localName.toLowerCase();
		if (isNonRendered(tag) || isHidden(element)) continue;
		if (tag === "br") {
			text += " ";
			continue;
		}

		if (INLINE_TAGS.has(tag)) text += collect(element);
		else text += ` ${collect(element)} `;
	}

	return text;
}
