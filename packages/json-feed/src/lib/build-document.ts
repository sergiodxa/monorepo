/**
 * Assembles feed metadata and items into the document a publisher serves: every
 * field under the name JSON Feed gives it, in the order the format lists them,
 * the empty ones left out, and every extension object copied through untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONFeed } from "../index.js";

import { VERSION } from "./constants.js";
import { extensionsOf } from "./utils.js";

/**
 * Builds the whole document.
 *
 * @param feed - The feed-level metadata
 * @param items - The items, in the order they should be published
 * @returns The document, ready to serialize
 */
export function buildDocument(feed: JSONFeed.Feed, items: JSONFeed.Item[]): JSONFeed.Document {
	let metadata: Omit<JSONFeed.Document, "items"> = {
		version: feed.version ?? VERSION,
		title: feed.title,
	};

	set(metadata, "home_page_url", feed.homePageUrl);
	set(metadata, "feed_url", feed.feedUrl);
	set(metadata, "description", feed.description);
	set(metadata, "user_comment", feed.userComment);
	set(metadata, "next_url", feed.nextUrl);
	set(metadata, "icon", feed.icon);
	set(metadata, "favicon", feed.favicon);
	set(metadata, "authors", buildAuthors(feed.authors));
	set(metadata, "author", buildAuthor(feed.author));
	set(metadata, "language", feed.language);
	set(metadata, "expired", feed.expired);
	set(metadata, "hubs", buildHubs(feed.hubs));

	for (let [key, extension] of extensionsOf(feed)) {
		metadata[key] = structuredClone(extension);
	}

	/** The items come last, where a publisher and anyone reading the raw JSON expect them. */
	return { ...metadata, items: items.map(buildItem) };
}

/** Builds one item, keeping the field order the format documents. */
function buildItem(item: JSONFeed.Item): JSONFeed.DocumentItem {
	let written: JSONFeed.DocumentItem = { id: item.id };

	set(written, "url", item.url);
	set(written, "external_url", item.externalUrl);
	set(written, "title", item.title);
	set(written, "content_html", item.contentHtml);
	set(written, "content_text", item.contentText);
	set(written, "summary", item.summary);
	set(written, "image", item.image);
	set(written, "banner_image", item.bannerImage);
	set(written, "date_published", item.datePublished);
	set(written, "date_modified", item.dateModified);
	set(written, "authors", buildAuthors(item.authors));
	set(written, "author", buildAuthor(item.author));
	set(written, "tags", item.tags ? [...item.tags] : undefined);
	set(written, "language", item.language);
	set(written, "attachments", buildAttachments(item.attachments));

	for (let [key, extension] of extensionsOf(item)) {
		written[key] = structuredClone(extension);
	}

	return written;
}

/** Builds the authors, dropping any that would be written as an empty object. */
function buildAuthors(authors?: JSONFeed.Author[]): JSONFeed.Author[] | undefined {
	if (authors === undefined) return undefined;

	let written: JSONFeed.Author[] = [];
	for (let author of authors) {
		let entry = buildAuthor(author);
		if (entry) written.push(entry);
	}

	return written;
}

/**
 * Builds one author. JSON Feed requires at least one of the three fields, so an
 * author holding none is written as no author at all.
 */
function buildAuthor(author?: JSONFeed.Author): JSONFeed.Author | undefined {
	if (author === undefined) return undefined;

	let written: JSONFeed.Author = {};
	set(written, "name", author.name);
	set(written, "url", author.url);
	set(written, "avatar", author.avatar);

	return Object.keys(written).length > 0 ? written : undefined;
}

/** Builds the notification endpoints, both of whose fields the format requires. */
function buildHubs(hubs?: JSONFeed.Hub[]): JSONFeed.Hub[] | undefined {
	if (hubs === undefined) return undefined;

	let written: JSONFeed.Hub[] = [];
	for (let hub of hubs) {
		if (hub.type && hub.url) written.push({ type: hub.type, url: hub.url });
	}

	return written;
}

/** Builds the attachments, each of which the format identifies by its location. */
function buildAttachments(
	attachments?: JSONFeed.Attachment[],
): JSONFeed.DocumentAttachment[] | undefined {
	if (attachments === undefined) return undefined;

	let written: JSONFeed.DocumentAttachment[] = [];

	for (let attachment of attachments) {
		if (!attachment.url) continue;

		let entry: JSONFeed.DocumentAttachment = { url: attachment.url };
		set(entry, "mime_type", attachment.mimeType);
		set(entry, "title", attachment.title);
		set(entry, "size_in_bytes", attachment.sizeInBytes);
		set(entry, "duration_in_seconds", attachment.durationInSeconds);

		written.push(entry);
	}

	return written;
}

/**
 * Writes one field when it carries something to read, so the document holds no
 * empty strings, empty lists, or keys a reader would have to test before using.
 *
 * @param target - The object being built
 * @param key - The field to write
 * @param value - The value to write, when there is one
 * @template T - The object being built
 * @template K - The field being written
 */
function set<T extends object, K extends keyof T>(
	target: T,
	key: K,
	value: T[K] | undefined,
): void {
	if (value === undefined || value === "") return;
	if (Array.isArray(value) && value.length === 0) return;

	target[key] = value;
}
