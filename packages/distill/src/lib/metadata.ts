/**
 * Reads what a page says about itself: the headline, whose name is on it, and the
 * address it calls its own. Each is read off the page as served, so a page that
 * declares nothing leaves the caller with the URL it asked for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMDocument } from "@sdxc/html/document";

/** The meta names a headline is declared under, in the order they are trusted. */
const TITLE_KEYS = ["og:title", "twitter:title"];

/** The meta names an author is declared under, in the order they are trusted. */
const BYLINE_KEYS = ["author", "article:author", "og:article:author", "twitter:creator"];

/** Whitespace-normalized text, or `undefined` when there is none to read. */
function clean(value: string | null | undefined): string | undefined {
	let text = (value ?? "").replaceAll(/\s+/gu, " ").trim();
	return text.length > 0 ? text : undefined;
}

/** A meta tag's content, matching `name` or `property` so `og:` tags are one lookup. */
function metaContent(document: DOMDocument, key: string): string | undefined {
	for (let tag of Array.from(document.querySelectorAll("meta"))) {
		let declared = tag.getAttribute("name") ?? tag.getAttribute("property");
		if (declared?.toLowerCase() === key) return clean(tag.getAttribute("content"));
	}
	return undefined;
}

/**
 * The headline the page declares, preferring what it shares links under to the
 * window title, which carries the publication's own name on most templates.
 *
 * @param document - The page as it was served.
 */
export function titleOf(document: DOMDocument): string | null {
	for (let key of TITLE_KEYS) {
		let declared = metaContent(document, key);
		if (declared !== undefined) return declared;
	}

	let heading = document.querySelector("h1");
	let element = document.querySelector("title");

	return clean(element?.textContent) ?? clean(heading?.textContent) ?? null;
}

/**
 * Whose name the page puts on the article, read from what it declares rather than
 * from the markup around the headline, which no two templates spell alike.
 *
 * @param document - The page as it was served.
 */
export function bylineOf(document: DOMDocument): string | null {
	for (let key of BYLINE_KEYS) {
		let declared = metaContent(document, key);
		if (declared !== undefined) return declared;
	}

	let authored = document.querySelector('[rel="author"]');
	return clean(authored?.textContent) ?? null;
}

/**
 * The address the page calls its own, which is what makes two paths onto one article
 * one entry rather than several. A declaration that is not a URL leaves the address
 * the chain actually ended at.
 *
 * @param document - The page as it was served.
 * @param fetched - Where the redirect chain ended.
 */
export function canonicalOf(document: DOMDocument, fetched: string): string {
	for (let tag of Array.from(document.querySelectorAll("link"))) {
		let rel = clean(tag.getAttribute("rel"))?.toLowerCase().split(" ") ?? [];
		if (!rel.includes("canonical")) continue;

		let href = clean(tag.getAttribute("href"));
		if (href === undefined) continue;

		try {
			let declared = new URL(href, fetched);
			if (declared.protocol === "http:" || declared.protocol === "https:") return declared.href;
		} catch {
			return fetched;
		}
	}

	return fetched;
}
