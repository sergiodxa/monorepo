/**
 * Prints an extracted article as elements rather than as a string of markup. The body
 * arrives sanitized, and this reads it back into a tree the renderer builds itself, so
 * what reaches the page is escaped and shaped by the same machinery every other page here
 * is drawn with.
 *
 * It is deliberately a second reading of the same markup: the allow-list decides what may
 * exist and this decides nothing, so a tag or an attribute that was never permitted has no
 * path onto the page even if it survived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMElement, DOMNode } from "@sdxc/html/document";
import type { Handle, RemixNode } from "remix/ui";

import { parseDocument } from "@sdxc/html/document";
import { isFailure } from "@sdxc/result";
import { maxIs } from "@sdxc/u/size";
import { font, leading } from "@sdxc/u/typography";
import { createElement } from "remix/ui";

/** What a tree calls an element, and what it calls a run of text. */
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Width the article's column stops growing at, which is a comfortable measure to read. */
const ARTICLE_COLUMN = "42rem";

/**
 * Attributes the renderer spells differently from the markup. Everything else reaches a
 * prop under the name the markup wrote it with.
 */
const PROP_NAMES: Record<string, string> = {
	colspan: "colSpan",
	datetime: "dateTime",
	loading: "loading",
	referrerpolicy: "referrerPolicy",
	rowspan: "rowSpan",
};

/** Elements that close themselves, and so take no children however the tree reads. */
const VOID_TAGS = new Set(["br", "hr", "img"]);

/** One node as the renderer builds it, which is nothing for a node a reader never sees. */
function print(node: DOMNode, key: number): RemixNode {
	if (node.nodeType === TEXT_NODE) return node.nodeValue ?? "";
	if (node.nodeType !== ELEMENT_NODE) return null;

	let element = node as DOMElement;
	let tag = element.localName.toLowerCase();

	let props: Record<string, unknown> = { key };
	for (let attribute of Array.from(element.attributes)) {
		props[PROP_NAMES[attribute.name] ?? attribute.name] = attribute.value;
	}

	if (VOID_TAGS.has(tag)) return createElement(tag, props);

	return createElement(tag, props, ...children(element));
}

/** Every child of an element, in the order the markup wrote them. */
function children(element: DOMElement): RemixNode[] {
	return Array.from(element.childNodes).map((child, index) => print(child, index));
}

/**
 * The article's body. An article that reads back as nothing prints nothing, which is the
 * same thing to a reader as a page that carried none.
 */
export default function Article(handle: Handle<{ html: string }>) {
	return () => {
		let document = parseDocument(handle.props.html);
		if (isFailure(document)) return null;

		return (
			<div mix={[font("reading"), leading("relaxed"), maxIs(ARTICLE_COLUMN)]}>
				{children(document.data.body)}
			</div>
		);
	};
}
