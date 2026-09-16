/**
 * Reads a parsed tree as a subscription list: the root that identifies the document,
 * and every feed nested anywhere under it. Twenty years of exports have made the file
 * forgiving to read, so a name is matched however an exporter spelled it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { XML } from "@sdxc/xml";

import { failure, success } from "@sdxc/result";

import type { OPML } from "../index.js";

import { OPMLParseError } from "../index.js";

/**
 * Reads the subscriptions a document lists, answering with the reason it is not one
 * when the root says so. The root is the whole of that check, so an error page served
 * under a `200` in an export's place reports itself rather than reading as empty.
 *
 * @param root - The root element of the parsed document
 * @returns The subscriptions in document order, or why the document is not OPML
 */
export function readDocument(root: XML.Element): Result<OPML.Outline[], OPMLParseError> {
	if (localName(root.name).toLowerCase() !== "opml") {
		return failure(new OPMLParseError(`Expected an <opml> root, received <${root.name}>.`));
	}

	let outlines: OPML.Outline[] = [];
	collect(root, outlines, new Set<string>(), undefined);

	return success(outlines);
}

/**
 * Walks the tree depth-first, so a folder's feeds follow the folder and the whole
 * list reads in the order someone filed it. An outline is visited whether or not it
 * became a subscription, which is what keeps the feeds inside a folder.
 *
 * `folder` is the name of the nearest enclosing outline that named no feed, which each
 * subscription found below it carries. A nested folder replaces it rather than joining to
 * it, so what a feed keeps is the name written directly over it; a group that named itself
 * nothing leaves the name above it standing.
 */
function collect(
	element: XML.Element,
	outlines: OPML.Outline[],
	seen: Set<string>,
	folder: string | undefined,
): void {
	for (let child of element.children ?? []) {
		if (typeof child === "string") continue;

		if (localName(child.name).toLowerCase() !== "outline") {
			collect(child, outlines, seen, folder);
			continue;
		}

		let outline = toOutline(child);

		if (outline) {
			if (folder) outline.folder = folder;

			if (!seen.has(outline.feedUrl)) {
				seen.add(outline.feedUrl);
				outlines.push(outline);
			}

			collect(child, outlines, seen, folder);
			continue;
		}

		collect(child, outlines, seen, title(child) ?? folder);
	}
}

/** What an outline calls itself, which is the name a folder's feeds are filed under. */
function title(element: XML.Element): string | undefined {
	return attribute(element, "text") ?? attribute(element, "title");
}

/**
 * Reads one outline as a subscription, which it is only when it names a feed, since
 * an outline without `xmlUrl` is the folder that holds others. The title falls through
 * four attributes because a caller needs something to label a row with either way.
 */
function toOutline(element: XML.Element): OPML.Outline | undefined {
	let feedUrl = attribute(element, "xmlurl");
	if (!feedUrl) return undefined;

	let siteUrl = attribute(element, "htmlurl");
	let title = attribute(element, "text") ?? attribute(element, "title") ?? siteUrl ?? feedUrl;

	let outline: OPML.Outline = { title, feedUrl };
	if (siteUrl) outline.siteUrl = siteUrl;

	return outline;
}

/**
 * Reads an attribute by its lowercased name, so the `xmlUrl` the specification names
 * is found in the several casings exports have shipped it under. A value of nothing
 * but whitespace reads as absent, so the caller's fallback takes over.
 */
function attribute(element: XML.Element, name: string): string | undefined {
	for (let [key, value] of Object.entries(element.attributes ?? {})) {
		if (key.toLowerCase() !== name) continue;
		let trimmed = value.trim();
		if (trimmed) return trimmed;
	}

	return undefined;
}

/**
 * Strips the prefix off a qualified name. The XML layer resolves no namespaces, so a
 * document that binds a prefix over its own elements is matched by the same
 * comparison as the many that declare none.
 */
function localName(name: string): string {
	let separator = name.indexOf(":");
	if (separator === -1) return name;
	return name.slice(separator + 1);
}
