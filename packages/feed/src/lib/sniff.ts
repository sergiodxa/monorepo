/**
 * Decides which format a document is written in by looking at its root element,
 * because the `Content-Type` a feed is served under is not evidence: feeds arrive
 * as `text/xml`, `application/octet-stream`, and worse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { XML } from "@sdxc/xml";

import { failure, success } from "@sdxc/result";

import type { Feed } from "../index.js";

import { FeedFormatError } from "../index.js";

import { localName, readNamespaces } from "./utils.js";

/** The namespace an Atom document's root element must resolve to. */
const ATOM_NAMESPACE = "http://www.w3.org/2005/Atom";

/**
 * Identifies the format of a parsed document.
 *
 * @param xml - The parsed document
 * @returns The format, or the reason it is not one this package reads
 */
export function sniff(xml: XML): Result<Feed.Format, FeedFormatError> {
	let root = xml.root;
	let name = localName(root.name);

	if (name === "rss") return success("rss");

	if (name === "feed") {
		let namespaces = readNamespaces(root);
		let prefix = root.name.includes(":") ? root.name.slice(0, root.name.indexOf(":")) : "";
		if (namespaces[prefix] === ATOM_NAMESPACE) return success("atom");
		return failure(new FeedFormatError("Expected the feed element in the Atom namespace."));
	}

	/**
	 * RSS 1.0 is RDF and shares almost nothing with RSS 2.0, so naming it is far
	 * more useful to a caller than the parse failure it would otherwise hit.
	 */
	if (name === "RDF") {
		return failure(new FeedFormatError("RSS 1.0 (RDF) feeds are not supported."));
	}

	return failure(new FeedFormatError(`Expected an RSS or Atom document, found "${root.name}".`));
}
