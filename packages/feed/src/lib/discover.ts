/**
 * Finds the feeds an HTML page advertises, following the autodiscovery convention
 * of a `<link rel="alternate">` whose type names a syndication format.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Feed } from "../index.js";

import { parseHtmlLinks } from "./parse-html-links.js";
import { dedupeBy } from "./utils.js";

/**
 * The media types that identify a feed.
 *
 * `text/xml` and `application/xml` are deliberately absent: they are common on
 * sitemaps and stylesheets, so accepting them would offer a reader documents it
 * cannot read as feeds.
 */
const FEED_TYPES = new Set(["application/rss+xml", "application/atom+xml"]);

/**
 * Reads the feeds a page points at.
 *
 * Document order is preserved, because the convention is that the first alternate
 * link is the site's main feed.
 *
 * @param html - The page's text
 * @param pageUrl - The URL the page came from, resolving links that declare no base
 * @returns The feeds found, in document order and without repeats
 */
export function discoverFeeds(html: string, pageUrl: string): Feed.Discovery[] {
	let { base, links } = parseHtmlLinks(html);
	let resolveAgainst = resolveBase(base, pageUrl);

	let found: Feed.Discovery[] = [];

	for (let link of links) {
		let type = link["type"]?.toLowerCase();
		if (!type || !FEED_TYPES.has(type)) continue;
		if (!hasAlternateRelation(link["rel"])) continue;

		let url = absolute(link["href"], resolveAgainst);
		if (!url) continue;

		let discovery: Feed.Discovery = { url, type };
		if (link["title"]) discovery.title = link["title"];
		found.push(discovery);
	}

	return dedupeBy(found, (discovery) => discovery.url);
}

/**
 * Reports whether a relation list marks the link as an alternate representation.
 *
 * `rel` holds space-separated tokens and is matched case-insensitively, because
 * `rel="ALTERNATE"` occurs in the wild however the specification spells it.
 */
function hasAlternateRelation(rel?: string): boolean {
	if (!rel) return false;
	return rel.toLowerCase().split(/\s+/).includes("alternate");
}

/** Resolves the declared base against the page's URL, since it may itself be relative. */
function resolveBase(base: string | undefined, pageUrl: string): string {
	if (!base) return pageUrl;

	try {
		return new URL(base, pageUrl).toString();
	} catch {
		return pageUrl;
	}
}

/** Resolves one href, dropping anything that cannot form a URL. */
function absolute(href: string | undefined, base: string): string | undefined {
	if (!href) return undefined;

	try {
		return new URL(href, base).toString();
	} catch {
		return undefined;
	}
}
