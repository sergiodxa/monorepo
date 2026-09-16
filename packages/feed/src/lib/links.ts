/**
 * The link relations a feed declares, folded out of the three document formats and
 * out of the response's own `Link` header into one list, plus the hub selection a
 * push-protocol subscriber makes over that list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Atom } from "@sdxc/atom";
import type { JSONFeed } from "@sdxc/json-feed";
import type { RSS } from "@sdxc/rss";

import type { Feed } from "../index.js";

import { toLinks } from "./select-link.js";
import { resolveUrl } from "./utils.js";

/** The relation RFC 4287 gives a link that declares none. */
const DEFAULT_REL = "alternate";

/** The relation a push-protocol endpoint is advertised under. */
const HUB_REL = "hub";

/** The only scheme a hub may be reached over, since a subscription carries a secret. */
const SECURE_PROTOCOL = "https:";

/** One `<…>; rel=…; type=…` entry of a `Link` header, before its parameters are read. */
const HEADER_ENTRY = /<([^>]*)>([^,]*)/g;

/** One `; name=value` parameter of a header entry, quoted or bare. */
const HEADER_PARAMETER = /;\s*([^=;\s]+)\s*=\s*(?:"([^"]*)"|([^;,\s]+))/g;

/**
 * Reads an Atom feed element's relations, applying the `alternate` default the
 * format leaves implicit so a caller never has to know which links omitted one.
 *
 * @param link - The feed element's links, in document order
 * @param url - The document's own URL, which relative hrefs resolve against
 */
export function fromAtomLinks(link: Atom.LinkInput | undefined, url?: string): Feed.Link[] {
	return normalize(toLinks(link), url);
}

/**
 * Reads an RSS channel's `atom:link` relations, which is where an RSS 2.0
 * publisher declares the addresses the format itself has no element for.
 *
 * @param atomLink - The channel's `atom:link` elements, in document order
 * @param url - The document's own URL, which relative hrefs resolve against
 */
export function fromRSSLinks(atomLink: RSS.AtomLinkInput | undefined, url?: string): Feed.Link[] {
	if (atomLink === undefined) return [];
	return normalize(Array.isArray(atomLink) ? atomLink : [atomLink], url);
}

/**
 * Reads a JSON Feed's relations, which the format spells as fields rather than as
 * links: `feed_url` is the address the document claims for itself, and each entry
 * of `hubs` is an endpoint that pushes when the feed changes.
 *
 * @param feed - The parsed JSON Feed document
 * @param url - The document's own URL, which relative addresses resolve against
 */
export function fromJSONFeedLinks(feed: JSONFeed.Feed, url?: string): Feed.Link[] {
	let declared: { rel: string; href?: string; type?: string }[] = [];

	if (feed.feedUrl) declared.push({ rel: "self", href: feed.feedUrl });
	for (let hub of feed.hubs ?? []) declared.push({ rel: HUB_REL, href: hub.url, type: hub.type });

	return normalize(declared, url);
}

/**
 * Reads the relations a response declared in its `Link` header (RFC 8288).
 *
 * A header relation is what a publisher on a hosted platform can set when they
 * cannot edit the document, which is why it is read at all and why it outranks the
 * document wherever the two disagree.
 *
 * @param response - The response whose headers carry the relations
 * @param url - The address the response came from, which relative targets resolve against
 */
export function fromLinkHeader(response: Response, url?: string): Feed.Link[] {
	let header = response.headers.get("link");
	if (!header) return [];

	let declared: { rel: string; href: string; type?: string }[] = [];

	for (let [, target, parameters] of header.matchAll(HEADER_ENTRY)) {
		let read = readParameters(parameters ?? "");
		if (read.rel === undefined) continue;

		/** One entry may name several relations, each of which stands on its own. */
		for (let rel of read.rel.split(/\s+/)) {
			if (rel === "") continue;
			let entry: { rel: string; href: string; type?: string } = { rel, href: target ?? "" };
			if (read.type !== undefined) entry.type = read.type;
			declared.push(entry);
		}
	}

	return normalize(declared, url);
}

/**
 * The hub to subscribe to, or `undefined` where there is none worth using.
 *
 * The header wins over the document, since that is the one a publisher who cannot
 * edit their feed can still set, and the first relation wins within each. A hub
 * reached over anything but `https:` is passed over: a subscription carries a
 * shared secret in a request body, which plain HTTP puts on the wire in clear.
 *
 * @param header - The relations the response's own `Link` header declared
 * @param document - The relations the feed document declared, in document order
 * @example let hub = Feed.selectHub(fetched.links, fetched.feed.links);
 */
export function selectHub(
	header: readonly Feed.Link[] = [],
	document: readonly Feed.Link[] = [],
): Feed.Hub | undefined {
	let fromHeader = firstHub(header);
	if (fromHeader !== undefined) return { url: fromHeader, source: "header" };

	let fromDocument = firstHub(document);
	if (fromDocument !== undefined) return { url: fromDocument, source: "document" };

	return undefined;
}

/** The first usable hub of one list, which is the one the spec tells a subscriber to take. */
function firstHub(links: readonly Feed.Link[]): string | undefined {
	for (let link of links) {
		if (link.rel !== HUB_REL) continue;
		if (!isSecure(link.href)) continue;
		return link.href;
	}

	return undefined;
}

/** Whether an address is one a secret may be sent to. */
function isSecure(href: string): boolean {
	try {
		return new URL(href).protocol === SECURE_PROTOCOL;
	} catch {
		return false;
	}
}

/** Reads the parameters of one header entry, keeping the first of each name. */
function readParameters(source: string): { rel?: string; type?: string } {
	let parameters: { rel?: string; type?: string } = {};

	for (let [, name, quoted, bare] of source.matchAll(HEADER_PARAMETER)) {
		let value = quoted ?? bare;
		if (value === undefined || name === undefined) continue;

		let key = name.toLowerCase();
		if (key === "rel" && parameters.rel === undefined) parameters.rel = value.toLowerCase();
		if (key === "type" && parameters.type === undefined) parameters.type = value;
	}

	return parameters;
}

/**
 * Brings every source into the one shape a caller reads: the relation lower-cased,
 * since it is case-insensitive wherever it is declared, and the target resolved
 * against the document so a caller never has to know what it was relative to.
 */
function normalize(
	declared: readonly { rel?: string; href?: string; type?: string }[],
	url?: string,
): Feed.Link[] {
	let links: Feed.Link[] = [];

	for (let entry of declared) {
		let href = resolveUrl(entry.href, url);
		if (!href) continue;

		let link: Feed.Link = { rel: (entry.rel ?? DEFAULT_REL).toLowerCase(), href };
		if (entry.type) link.type = entry.type;
		links.push(link);
	}

	return links;
}
