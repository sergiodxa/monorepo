/**
 * Reads and writes an entry's `content` element, which extends a text construct
 * with any media type and with `src` for a body held out of line (RFC 4287 §4.1.3).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { XML } from "@sdxc/xml";

import type { Atom } from "../index.js";

import type { Scope } from "./xml-base.js";

import { cloneAttributes } from "./clone.js";
import { parseText } from "./text-construct.js";
import { getElementText } from "./utils.js";
import { resolveUri } from "./xml-base.js";

/**
 * Reads the content element.
 *
 * A `src` body is reported without a value, because the element is empty by
 * definition and inventing one would hide that the body lives elsewhere. Text,
 * HTML and XHTML share the text construct's reading; any other media type is
 * handed back as the raw string it was written as, undecoded.
 *
 * @param element - The content element
 * @param scope - The base and language in effect
 * @returns The parsed content
 */
export function parseContent(element: XML.Element, scope: Scope): Atom.Content {
	let attributes = { ...element.attributes };
	let type = attributes["type"];
	let src = attributes["src"];

	delete attributes["type"];
	delete attributes["src"];

	let content: Atom.Content = {};
	if (type !== undefined) content.type = type;
	if (src !== undefined) content.src = resolveUri(scope, src);

	if (src === undefined) content.value = readValue(element, type);

	let remaining = cloneAttributes(attributes);
	if (remaining) content.attributes = remaining;

	return content;
}

/**
 * Reads an inline body, routing the three text types through the text construct
 * and leaving every other media type as the source text.
 */
function readValue(element: XML.Element, type?: string): string {
	if (type === undefined || type === "text" || type === "html" || type === "xhtml") {
		let text = parseText(element);
		return typeof text === "string" ? text : text.value;
	}

	return getElementText(element);
}

/**
 * Builds the content element.
 *
 * An `xhtml` body is written back as `html` for the reason the text constructs
 * are: by this point the markup is a string, and re-parsing it to rebuild a
 * wrapper would fail on any fragment the XML parser rejects.
 *
 * @param content - The content to serialize
 * @returns The element, ready to place in an entry
 */
export function buildContentElement(content: Atom.Content): XML.Element {
	let attributes: Record<string, string> = { ...content.attributes };

	if (content.type !== undefined)
		attributes["type"] = content.type === "xhtml" ? "html" : content.type;
	if (content.src !== undefined) attributes["src"] = content.src;

	return {
		name: "content",
		attributes,
		children: content.src === undefined && content.value !== undefined ? [content.value] : [],
	};
}
