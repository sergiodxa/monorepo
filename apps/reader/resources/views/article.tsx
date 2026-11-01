/**
 * Prints an extracted article as elements rather than as a string of markup. The body
 * arrives sanitized, and this reads it back into a tree the renderer builds itself, so
 * what reaches the page is escaped and shaped by the same machinery every other page here
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMElement, DOMNode } from "@sdxc/html/document";
import type { Handle, RemixNode } from "remix/component";

import { parseDocument } from "@sdxc/html/document";
import { isFailure } from "@sdxc/result";
import { font } from "@sdxc/u/typography";
import { createElement, css } from "remix/component";

/** What a tree calls an element, and what it calls a run of text. */
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

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
			<div
				data-slot="article-body"
				mix={[
					font("reading"),
					/**
					 * Set for long reading: a size a little above the interface's, open leading,
					 * paragraphs parted by a line's worth of space, and every block a publisher
					 * may send (figures, code, quotes, tables) held inside the column.
					 */
					css({
						fontSize: "1.0625rem",
						lineHeight: "1.7",
						color: "var(--ui-neutral-fg-emphasis)",
						overflowWrap: "break-word",
						"& > :first-child": { marginBlockStart: "0" },
						"& p, & ul, & ol, & blockquote, & pre, & figure, & table, & dl": {
							marginBlock: "0 1.25em",
						},
						"& h1, & h2, & h3, & h4, & h5, & h6": {
							marginBlock: "1.75em 0.5em",
							lineHeight: "1.3",
							fontWeight: "600",
							textWrap: "balance",
						},
						"& h1, & h2": { fontSize: "1.375em" },
						"& h3": { fontSize: "1.1875em" },
						"& h4, & h5, & h6": { fontSize: "1em" },
						"& a": {
							color: "var(--ui-brand-fg)",
							textDecorationLine: "underline",
							textDecorationThickness: "1px",
							textUnderlineOffset: "0.2em",
						},
						"& :is(h1, h2, h3, h4, h5, h6) a": { color: "inherit", textDecorationLine: "none" },
						"& ul, & ol": { paddingInlineStart: "1.5em" },
						"& li + li": { marginBlockStart: "0.375em" },
						"& img, & video, & iframe": {
							display: "block",
							maxInlineSize: "100%",
							blockSize: "auto",
							marginInline: "auto",
							borderRadius: "0.5rem",
						},
						"& figcaption": {
							marginBlockStart: "0.5em",
							fontSize: "0.875em",
							color: "var(--ui-neutral-fg-muted)",
							textAlign: "center",
						},
						"& blockquote": {
							marginInline: "0",
							paddingInlineStart: "1em",
							borderInlineStart: "3px solid var(--ui-neutral-border)",
							color: "var(--ui-neutral-fg)",
						},
						"& code, & pre": {
							fontFamily: "var(--ui-font-mono, ui-monospace, monospace)",
							fontSize: "0.875em",
						},
						"& :not(pre) > code": {
							paddingInline: "0.3em",
							borderRadius: "0.25rem",
							backgroundColor: "var(--ui-neutral-bg-tint)",
						},
						"& pre": {
							overflowX: "auto",
							padding: "1em",
							lineHeight: "1.5",
							borderRadius: "0.5rem",
							backgroundColor: "var(--ui-neutral-bg-tint)",
						},
						"& table": {
							display: "block",
							overflowX: "auto",
							borderCollapse: "collapse",
							fontSize: "0.9375em",
						},
						"& th, & td": {
							padding: "0.375em 0.75em",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							textAlign: "start",
						},
						"& hr": {
							marginBlock: "2em",
							border: "0",
							borderBlockStart: "1px solid var(--ui-neutral-border)",
						},
					}),
				]}
			>
				{children(document.data.body)}
			</div>
		);
	};
}
