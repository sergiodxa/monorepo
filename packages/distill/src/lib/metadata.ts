/**
 * Reads what a page says about itself: the headline, whose name is on it, what it is
 * about, and the address it calls its own. Each is read off the page as served, so a
 * page that declares nothing leaves the caller with the URL it asked for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMDocument, DOMElement } from "@sdxc/html/document";

import { isBuried, PROSE_FLOOR } from "./score.js";

/** The meta names a headline is declared under, in the order they are trusted. */
const TITLE_KEYS = ["og:title", "twitter:title"];

/** The meta names an author is declared under, in the order they are trusted. */
const BYLINE_KEYS = ["author", "article:author", "og:article:author", "twitter:creator"];

/** The meta names a summary is declared under, in the order they are trusted. */
const DESCRIPTION_KEYS = ["og:description", "description", "twitter:description"];

/**
 * Characters an excerpt may run, a couple of sentences: enough to say what the page is
 * about in a list of links, short enough to stay the publisher's teaser.
 */
export const EXCERPT_LENGTH = 300;

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
 * What the page is about in a couple of sentences: the summary it shares links under,
 * else the article's first paragraph of prose, cut at the last whole word that fits.
 *
 * @param document - The page as it was served.
 * @param body - The article found in it, or `null` when the page carried none.
 */
export function excerptOf(document: DOMDocument, body: DOMElement | null): string | null {
	for (let key of DESCRIPTION_KEYS) {
		let declared = metaContent(document, key);
		if (declared !== undefined) return shorten(declared);
	}

	for (let paragraph of Array.from(body?.querySelectorAll("p") ?? [])) {
		if (isBuried(paragraph)) continue;
		let text = clean(paragraph.textContent);
		if (text !== undefined && text.length >= PROSE_FLOOR) return shorten(text);
	}

	return null;
}

/** Text within {@link EXCERPT_LENGTH}, ending on a whole word and an ellipsis when cut. */
function shorten(text: string): string {
	if (text.length <= EXCERPT_LENGTH) return text;

	let cut = text.slice(0, EXCERPT_LENGTH - 1);
	let boundary = cut.lastIndexOf(" ");
	let kept = boundary > 0 ? cut.slice(0, boundary) : cut;

	return `${kept.replace(/[\s,;:.]+$/u, "")}…`;
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
