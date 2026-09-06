/**
 * Normalizes an Atom document into the shared feed shape, applying the reader
 * policies the parser deliberately leaves open: which link is the page, and where
 * an entry's author comes from when the entry itself names none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { XML } from "@sdxc/xml";

import { Atom } from "@sdxc/atom";
import { failure, isFailure, success } from "@sdxc/result";

import type { Feed } from "../index.js";

import { FeedParseError } from "../index.js";

import { fromPersons } from "./authors.js";
import { toDate } from "./dates.js";
import { selectAlternate, selectEnclosures, selectSelf } from "./select-link.js";
import { dedupeBy, firstText, isAbsoluteUrl, resolveUrl } from "./utils.js";

/**
 * Reads an Atom document into the normalized shape.
 *
 * @param xml - The parsed document
 * @param url - The document's own URL, for resolving relative links
 * @returns The normalized feed, or the reason the document could not be read
 */
export function fromAtom(xml: XML, url?: string): Result<Feed.Data, FeedParseError> {
	let parsed = Atom.fromXML(xml, url);
	if (isFailure(parsed)) return failure(new FeedParseError(parsed.error.message));

	let atom = parsed.data;
	let feed = atom.feed;
	let feedAuthors = fromPersons(feed.author);

	let items = atom.entries.map((entry) => toItem(entry, feedAuthors, url));

	let data: Feed.Data = {
		format: "atom",
		/** Atom requires a title, but permits an empty one; a reader substitutes its own. */
		title: readText(feed.title) ?? "",
		items: dedupeBy(items, (item) => item.guid),
	};

	let description = readText(feed.subtitle);
	if (description) data.description = description;

	/** The feed's id doubles as the site URL when it is an http(s) URI, which is common. */
	let siteUrl = resolveUrl(
		firstText(selectAlternate(feed.link), isAbsoluteUrl(feed.id) ? feed.id : undefined),
		url,
	);
	if (siteUrl) data.siteUrl = siteUrl;

	let feedUrl = resolveUrl(firstText(selectSelf(feed.link), url), url);
	if (feedUrl) data.feedUrl = feedUrl;

	if (feed.lang) data.language = feed.lang;

	let imageUrl = resolveUrl(firstText(feed.logo, feed.icon), url);
	if (imageUrl) data.imageUrl = imageUrl;

	let updatedAt = toDate(feed.updated);
	if (updatedAt) data.updatedAt = updatedAt;

	return success(data);
}

/** Normalizes one entry, falling back through the author chain RFC 4287 allows. */
function toItem(entry: Atom.Entry, feedAuthors: Feed.Author[], url?: string): Feed.Item {
	let pageUrl = resolveUrl(selectAlternate(entry.link), url);

	let item: Feed.Item = {
		guid: firstText(entry.id, pageUrl, readText(entry.title)) ?? "",
	};

	let title = readText(entry.title);
	if (title) item.title = title;
	if (pageUrl) item.url = pageUrl;

	let summary = readText(entry.summary);
	let contentHtml = readContent(entry.content);
	if (contentHtml) item.contentHtml = contentHtml;
	if (summary) item.summary = summary;

	/**
	 * An entry may omit its author when the source it was copied from, or the feed
	 * itself, supplies one (RFC 4287 §4.1.2).
	 */
	let authors = fromPersons(entry.author);
	if (authors.length === 0) authors = fromPersons(entry.source?.author);
	if (authors.length === 0) authors = feedAuthors;

	if (authors.length > 0) {
		item.author = authors[0];
		item.authors = authors;
	}

	let categories = readCategories(entry.category);
	if (categories.length > 0) item.categories = categories;

	let enclosures = selectEnclosures(entry.link).map((link) => {
		let enclosure: Feed.Enclosure = { url: resolveUrl(link.href, url) ?? link.href };
		if (link.type) enclosure.type = link.type;
		if (link.length !== undefined && Number.isFinite(link.length)) enclosure.length = link.length;
		return enclosure;
	});
	if (enclosures.length > 0) item.enclosures = enclosures;

	let publishedAt = toDate(entry.published) ?? toDate(entry.updated);
	if (publishedAt) item.publishedAt = publishedAt;

	let updatedAt = toDate(entry.updated);
	if (updatedAt) item.updatedAt = updatedAt;

	return item;
}

/** Reads the string behind either text construct form. */
function readText(text?: Atom.TextInput): string | undefined {
	if (text === undefined) return undefined;
	let value = typeof text === "string" ? text : text.value;
	return value || undefined;
}

/**
 * Reads an entry's body, skipping content held out of line: a `src` body is a
 * pointer rather than markup, and inventing a fetch for it is a reader's choice.
 */
function readContent(content?: Atom.Content): string | undefined {
	if (!content || content.src !== undefined) return undefined;
	return content.value || undefined;
}

/** Reads category terms, preferring a human label when the document supplied one. */
function readCategories(category?: Atom.CategoryInput | Atom.CategoryInput[]): string[] {
	if (category === undefined) return [];

	let categories = Array.isArray(category) ? category : [category];
	let terms: string[] = [];

	for (let entry of categories) {
		let term = typeof entry === "string" ? entry : (entry.label ?? entry.term);
		if (term) terms.push(term);
	}

	return terms;
}
