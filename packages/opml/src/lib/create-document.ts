/**
 * Builds the tree a subscription list serializes from: the OPML 2.0 `head`/`body`
 * shape, with one `<outline>` per feed. Every value goes in as an attribute value for
 * the XML layer to escape, so nothing here concatenates markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { XML } from "@sdxc/xml";

import type { OPML } from "../index.js";

/** The version this package writes, and the one the `<outline>` shape below follows. */
const VERSION = "2.0";

/**
 * Builds the document for a set of subscriptions. The list is written flat, since
 * folders are a reader's own filing rather than anything a subscription carries.
 *
 * @param outlines - The subscriptions to write, in the order they should appear
 * @param options - The document's own title and creation date
 * @returns The document, ready to serialize
 */
export function createDocument(
	outlines: OPML.Outline[],
	options: OPML.StringifyOptions,
): XML.Document {
	return {
		declaration: { version: "1.0", encoding: "UTF-8" },
		root: {
			name: "opml",
			attributes: { version: VERSION },
			children: [
				{ name: "head", children: createHead(options) },
				{ name: "body", children: outlines.map(createOutlineElement) },
			],
		},
	};
}

/**
 * Builds the `head` children, keeping the elements the caller supplied values for so
 * a document never claims a title or a date that nobody gave it.
 */
function createHead(options: OPML.StringifyOptions): XML.Element[] {
	let children: XML.Element[] = [];

	if (options.title) children.push({ name: "title", children: [options.title] });

	if (options.dateCreated) {
		children.push({ name: "dateCreated", children: [options.dateCreated.toUTCString()] });
	}

	return children;
}

/**
 * Builds one subscription's element. The title goes to both `text`, which the
 * specification requires, and `title`, which some readers label a row from; `htmlUrl`
 * appears only for a subscription that knows its site.
 */
function createOutlineElement(outline: OPML.Outline): XML.Element {
	let attributes: Record<string, string> = {
		type: "rss",
		text: outline.title,
		title: outline.title,
		xmlUrl: outline.feedUrl,
	};

	if (outline.siteUrl) attributes.htmlUrl = outline.siteUrl;

	return { name: "outline", attributes };
}
