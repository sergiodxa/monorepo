/**
 * Normalizes a JSON Feed document into the shared feed shape, applying the reader
 * policies the format leaves open: where an item's identity and page come from,
 * and which of the two bodies an item published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { JSONFeed } from "@sdxc/json-feed";
import { failure, isFailure, success } from "@sdxc/result";

import type { Feed } from "../index.js";

import { FeedFormatError, FeedParseError } from "../index.js";

import { toDate } from "./dates.js";
import { dedupeBy, firstText, isAbsoluteUrl, resolveUrl } from "./utils.js";

/**
 * Reads a JSON Feed document into the normalized shape.
 *
 * @param value - The parsed JSON value
 * @param url - The document's own URL, for resolving relative links
 * @returns The normalized feed, or the reason the value could not be read
 */
export function fromJSONFeed(
	value: unknown,
	url?: string,
): Result<Feed.Data, FeedParseError | FeedFormatError> {
	if (JSONFeed.version(value) === undefined) {
		return failure(new FeedFormatError("Expected a JSON Feed document."));
	}

	let parsed = JSONFeed.fromJSON(value);
	if (isFailure(parsed)) return failure(new FeedParseError(parsed.error.message));

	let json = parsed.data;
	let feed = json.feed;
	let feedAuthors = toAuthors(feed.authors, feed.author);

	let items = json.items.map((item) => toItem(item, feedAuthors, url));

	let data: Feed.Data = {
		format: "json",
		title: feed.title,
		items: dedupeBy(items, (item) => item.guid),
	};

	if (feed.description) data.description = feed.description;

	let siteUrl = resolveUrl(feed.homePageUrl, url);
	if (siteUrl) data.siteUrl = siteUrl;

	let feedUrl = resolveUrl(firstText(feed.feedUrl, url), url);
	if (feedUrl) data.feedUrl = feedUrl;

	if (feed.language) data.language = feed.language;

	let imageUrl = resolveUrl(firstText(feed.icon, feed.favicon), url);
	if (imageUrl) data.imageUrl = imageUrl;

	/** JSON Feed declares no date of its own, so the newest item stands for the feed. */
	let updatedAt = newestDate(data.items);
	if (updatedAt) data.updatedAt = updatedAt;

	return success(data);
}

/** Normalizes one item, falling back to the feed's authors when the item names none. */
function toItem(item: JSONFeed.Item, feedAuthors: Feed.Author[], url?: string): Feed.Item {
	/** An id is ideally the item's own URL, which is what makes it a usable link. */
	let link = resolveUrl(firstText(item.url, isAbsoluteUrl(item.id) ? item.id : undefined), url);

	let normalized: Feed.Item = { guid: item.id };

	if (item.title) normalized.title = item.title;
	if (link) normalized.url = link;
	if (item.contentHtml) normalized.contentHtml = item.contentHtml;
	if (item.contentText) normalized.contentText = item.contentText;
	if (item.summary) normalized.summary = item.summary;

	let authors = toAuthors(item.authors, item.author);
	if (authors.length === 0) authors = feedAuthors;

	if (authors.length > 0) {
		normalized.author = authors[0];
		normalized.authors = authors;
	}

	if (item.tags && item.tags.length > 0) normalized.categories = [...item.tags];

	let enclosures = toEnclosures(item.attachments, url);
	if (enclosures.length > 0) normalized.enclosures = enclosures;

	let publishedAt = toDate(item.datePublished);
	if (publishedAt) normalized.publishedAt = publishedAt;

	let updatedAt = toDate(item.dateModified) ?? publishedAt;
	if (updatedAt) normalized.updatedAt = updatedAt;

	return normalized;
}

/**
 * Reads the authors, taking JSON Feed 1.1's list first and falling back to the
 * single author a 1.0 document wrote, which 1.1 tells a reader to prefer against.
 */
function toAuthors(authors?: JSONFeed.Author[], author?: JSONFeed.Author): Feed.Author[] {
	let source = authors && authors.length > 0 ? authors : author ? [author] : [];
	let normalized: Feed.Author[] = [];

	for (let entry of source) {
		let name = firstText(entry.name, entry.url);
		if (!name) continue;

		let value: Feed.Author = { name };
		if (entry.url) value.url = entry.url;
		normalized.push(value);
	}

	return normalized;
}

/** Normalizes the attached files, each of which the format identifies by its location. */
function toEnclosures(attachments?: JSONFeed.Attachment[], url?: string): Feed.Enclosure[] {
	if (attachments === undefined) return [];

	let enclosures: Feed.Enclosure[] = [];

	for (let attachment of attachments) {
		if (!attachment.url) continue;

		let enclosure: Feed.Enclosure = { url: resolveUrl(attachment.url, url) ?? attachment.url };
		if (attachment.mimeType) enclosure.type = attachment.mimeType;
		if (attachment.sizeInBytes !== undefined) enclosure.length = attachment.sizeInBytes;
		enclosures.push(enclosure);
	}

	return enclosures;
}

/** Reads the most recent date the items carry, which is when the feed last changed. */
function newestDate(items: Feed.Item[]): Date | undefined {
	let newest: Date | undefined;

	for (let item of items) {
		let date = item.updatedAt ?? item.publishedAt;
		if (!date) continue;
		if (!newest || date > newest) newest = date;
	}

	return newest;
}
