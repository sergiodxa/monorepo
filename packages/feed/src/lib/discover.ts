/**
 * Finds the feeds an HTML page advertises, following the autodiscovery convention
 * of a `<link rel="alternate">` whose type names a syndication format, and ranking
 * the JSON candidates so a well-typed feed wins over a generically typed one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Feed } from "../index.js";

import { parseHtmlLinks } from "./parse-html-links.js";
import { dedupeBy } from "./utils.js";

/** The media type a JSON Feed is published under. */
export const JSON_FEED_TYPE = "application/feed+json";

/** The media type a publisher serving a JSON Feed as ordinary JSON uses instead. */
const JSON_TYPE = "application/json";

/**
 * The media types that identify a feed.
 *
 * `text/xml` and `application/xml` are deliberately absent: they are common on
 * sitemaps and stylesheets, so accepting them would offer a reader documents it
 * cannot read as feeds.
 */
const FEED_TYPES = new Set([
	"application/rss+xml",
	"application/atom+xml",
	JSON_FEED_TYPE,
	JSON_TYPE,
]);

/** The media type each format is published under, for a URL that is itself a feed. */
const MEDIA_TYPES: Record<Feed.Format, string> = {
	rss: "application/rss+xml",
	atom: "application/atom+xml",
	json: JSON_FEED_TYPE,
};

/**
 * Names the media type a format is served under.
 *
 * @param format - The format a document turned out to be
 * @returns The media type to report for it
 */
export function mediaTypeOf(format: Feed.Format): string {
	return MEDIA_TYPES[format];
}

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

	return preferTypedJSON(dedupeBy(found, (discovery) => discovery.url));
}

/**
 * Drops the generically typed JSON candidates once a page names a JSON Feed one,
 * which is the preference JSON Feed asks a discovering app to apply: anything at
 * all is served as `application/json`, so it stands in only when nothing better does.
 */
function preferTypedJSON(found: Feed.Discovery[]): Feed.Discovery[] {
	if (!found.some((discovery) => discovery.type === JSON_FEED_TYPE)) return found;
	return found.filter((discovery) => discovery.type !== JSON_TYPE);
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
