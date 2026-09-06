/**
 * Reads and writes Atom text constructs, whose `type` decides whether the payload
 * is plain text, a run of HTML, or an XHTML subtree that has to be serialized back
 * into markup before a consumer can use it (RFC 4287 §3.1).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import type { Atom } from "../index.js";

import { DEFAULT_TEXT_TYPE } from "./constants.js";
import { getChildElements, getElementText, localName } from "./utils.js";

/** The characters that carry markup meaning when XHTML text is re-serialized. */
const TEXT_ESCAPES: Record<string, string> = {
	"<": "&lt;",
	">": "&gt;",
	"&": "&amp;",
};

const TEXT_PATTERN = /[<>&]/g;

/**
 * Reads one text construct.
 *
 * An `xhtml` construct collapses to the serialized markup its single `div`
 * wrapper contained — the wrapper itself is structural and is dropped — so every
 * construct hands back a string regardless of how it was written.
 *
 * @param element - The element holding the construct
 * @returns The construct, collapsed to a bare string when it carries no type
 */
export function parseText(element: XML.Element): Atom.TextInput {
	let type = element.attributes?.type ?? DEFAULT_TEXT_TYPE;

	if (type === "xhtml") return { value: readXhtml(element), type: "xhtml" };
	if (type === "html") return { value: getElementText(element), type: "html" };

	/**
	 * A `text` construct is the default, so the bare string says everything the
	 * structured form would and reads better at a call site.
	 */
	return getElementText(element);
}

/**
 * Serializes the children of an `xhtml` construct's wrapper.
 *
 * The wrapper is the `div` RFC 4287 §3.1.1.3 requires; when a document omits it
 * the element's own children are serialized instead, so malformed input still
 * yields the markup it meant rather than nothing.
 */
function readXhtml(element: XML.Element): string {
	let wrapper = getChildElements(element).find((child) => localName(child.name) === "div");
	let host = wrapper ?? element;

	let markup = "";
	for (let child of host.children ?? []) {
		if (typeof child === "string") {
			markup += escapeText(child);
			continue;
		}
		markup += stringifyElement(child);
	}

	return markup;
}

/**
 * Serializes one element of an XHTML construct back into markup.
 *
 * A failure yields the element's text alone, because losing the tags around a
 * paragraph is a better outcome for a reader than losing the paragraph.
 */
function stringifyElement(element: XML.Element): string {
	let result = XML.stringify(element);
	if (isFailure(result)) return escapeText(getElementText(element));
	return result.data;
}

/** Escapes the three characters that would otherwise read as markup. */
function escapeText(value: string): string {
	return value.replace(TEXT_PATTERN, (character) => TEXT_ESCAPES[character] ?? character);
}

/**
 * Builds the element for one text construct.
 *
 * An `xhtml` construct is written back as `html`: the value is markup in a string
 * by then, and re-parsing it to rebuild a wrapper would fail on any fragment the
 * XML parser rejects. The payload survives; the typing narrows.
 *
 * @param name - The element name to write
 * @param text - The construct to serialize
 * @returns The element, ready to place in a document
 */
export function buildTextElement(name: string, text: Atom.TextInput): XML.Element {
	if (typeof text === "string") return { name, attributes: {}, children: [text] };

	let type = text.type === "xhtml" ? "html" : text.type;
	let attributes: Record<string, string> = {};
	if (type && type !== DEFAULT_TEXT_TYPE) attributes["type"] = type;

	return { name, attributes, children: [text.value] };
}
