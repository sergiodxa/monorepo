/**
 * Normalizes an RSS 2.0 document into the shared feed shape, absorbing the
 * parser's exceptions into a `Result` and applying the identity fallback an item
 * without a guid needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { XML } from "@sdxc/xml";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import { RSS } from "@sdxc/rss";

import type { Feed } from "../index.js";

import { FeedParseError } from "../index.js";

import { parseMailbox } from "./authors.js";
import { toDate } from "./dates.js";
import { dedupeBy, firstText, resolveUrl } from "./utils.js";

/**
 * Reads an RSS document into the normalized shape.
 *
 * @param xml - The parsed document
 * @param url - The document's own URL, for resolving relative links
 * @returns The normalized feed, or the reason the document could not be read
 */
export function fromRSS(xml: XML, url?: string): Result<Feed.Data, FeedParseError> {
	/** The RSS parser signals a malformed document by throwing, so it is wrapped here. */
	let parsed = wrap(() => RSS.fromXML(xml));
	if (isFailure(parsed)) return failure(new FeedParseError(parsed.error.message));

	let rss = parsed.data;
	let channel = rss.channel;
	let channelAuthor = parseMailbox(channel.managingEditor);

	let items = rss.items.map((item) => toItem(item, channelAuthor, url));

	let data: Feed.Data = {
		format: "rss",
		title: channel.title,
		items: dedupeBy(items, (item) => item.guid),
	};

	if (channel.description) data.description = channel.description;

	let siteUrl = resolveUrl(channel.link, url);
	if (siteUrl) data.siteUrl = siteUrl;

	let feedUrl = resolveUrl(firstText(selectSelfLink(channel.atomLink), url), url);
	if (feedUrl) data.feedUrl = feedUrl;

	if (channel.language) data.language = channel.language;

	let imageUrl = resolveUrl(channel.image?.url, url);
	if (imageUrl) data.imageUrl = imageUrl;

	let updatedAt = toDate(firstText(channel.lastBuildDate, channel.pubDate));
	if (updatedAt) data.updatedAt = updatedAt;

	return success(data);
}

/** Normalizes one item, falling back to the channel's editor for attribution. */
function toItem(item: RSS.Item, channelAuthor: Feed.Author | undefined, url?: string): Feed.Item {
	let guid = readGuid(item);
	let link = resolveUrl(firstText(item.link, permalinkOf(item)), url);

	let normalized: Feed.Item = {
		guid: firstText(guid, link, item.title, item.description) ?? "",
	};

	if (item.title) normalized.title = item.title;
	if (link) normalized.url = link;

	/**
	 * `content:encoded` is the full body when a feed publishes both, which leaves
	 * `description` as the summary it was written to be.
	 */
	if (item.contentEncoded) {
		normalized.contentHtml = item.contentEncoded;
		if (item.description) normalized.summary = item.description;
	} else if (item.description) {
		normalized.contentHtml = item.description;
	}

	let author = parseMailbox(item.author) ?? readCreator(item.dcCreator) ?? channelAuthor;
	if (author) {
		normalized.author = author;
		normalized.authors = [author];
	}

	let categories = readCategories(item.category);
	if (categories.length > 0) normalized.categories = categories;

	let enclosures = readEnclosures(item.enclosure, url);
	if (enclosures.length > 0) normalized.enclosures = enclosures;

	let publishedAt = toDate(item.pubDate);
	if (publishedAt) {
		normalized.publishedAt = publishedAt;
		normalized.updatedAt = publishedAt;
	}

	return normalized;
}

/** Reads the guid value from either representation the parser reports. */
function readGuid(item: RSS.Item): string | undefined {
	if (typeof item.guid === "string") return item.guid || undefined;
	return item.guid?.value || undefined;
}

/**
 * Reads a guid that doubles as the item's URL. RSS 2.0 makes a guid a permalink
 * unless `isPermaLink` says otherwise, so an item with no `<link>` still resolves.
 */
function permalinkOf(item: RSS.Item): string | undefined {
	if (typeof item.guid === "string") return item.guid;
	if (!item.guid) return undefined;
	if (item.guid.isPermaLink === false) return undefined;
	return item.guid.value;
}

/** Reads the first `dc:creator`, which feeds use where RSS has no author element. */
function readCreator(creator?: string | string[]): Feed.Author | undefined {
	if (creator === undefined) return undefined;
	let first = Array.isArray(creator) ? creator[0] : creator;
	return parseMailbox(first);
}

/** Reads category terms from either the bare or the structured form. */
function readCategories(category?: RSS.CategoryInput | RSS.CategoryInput[]): string[] {
	if (category === undefined) return [];

	let categories = Array.isArray(category) ? category : [category];
	let terms: string[] = [];

	for (let entry of categories) {
		let term = typeof entry === "string" ? entry : entry.value;
		if (term) terms.push(term);
	}

	return terms;
}

/** Reads enclosures from either the single or the repeated form. */
function readEnclosures(enclosure?: RSS.EnclosureInput, url?: string): Feed.Enclosure[] {
	if (enclosure === undefined) return [];

	let enclosures = Array.isArray(enclosure) ? enclosure : [enclosure];
	let normalized: Feed.Enclosure[] = [];

	for (let entry of enclosures) {
		if (!entry.url) continue;
		let value: Feed.Enclosure = { url: resolveUrl(entry.url, url) ?? entry.url };
		if (entry.type) value.type = entry.type;
		if (entry.length !== undefined && Number.isFinite(entry.length)) value.length = entry.length;
		normalized.push(value);
	}

	return normalized;
}

/** Reads the feed's own address from an `atom:link rel="self"`, when it declares one. */
function selectSelfLink(atomLink?: RSS.AtomLinkInput): string | undefined {
	if (atomLink === undefined) return undefined;
	let links = Array.isArray(atomLink) ? atomLink : [atomLink];
	return links.find((link) => link.rel === "self")?.href;
}
