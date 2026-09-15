/**
 * Reads an arbitrary JSON value into feed metadata and items, naming each field
 * as this package does and keeping what a document got right, because JSON Feed
 * asks a reader to recover from a bad field rather than refuse the whole feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { JSONFeed } from "../index.js";

import { JSONFeedParseError } from "../index.js";

import { VERSION_PREFIX } from "./constants.js";
import {
	extensionsOf,
	isRecord,
	readBoolean,
	readId,
	readNumber,
	readString,
	readStringArray,
} from "./utils.js";

/** A document read apart into the metadata a feed holds and the items it lists. */
export interface ParsedFeed {
	feed: JSONFeed.Feed;
	items: JSONFeed.Item[];
}

/**
 * Reads one JSON value as a JSON Feed document.
 *
 * @param value - The parsed JSON value
 * @returns The metadata and items, or the reason the value is not a feed
 */
export function parseFeed(value: unknown): Result<ParsedFeed, JSONFeedParseError> {
	if (!isRecord(value)) {
		return failure(new JSONFeedParseError("Expected a JSON Feed object."));
	}

	let version = readString(value["version"]);
	if (!version?.startsWith(VERSION_PREFIX)) {
		return failure(new JSONFeedParseError("Expected a JSON Feed version URL."));
	}

	let title = readString(value["title"]);
	if (!title) return failure(new JSONFeedParseError("Feed must include a title."));

	if (!Array.isArray(value["items"])) {
		return failure(new JSONFeedParseError("Feed must include an items array."));
	}

	return success({ feed: readFeed(value, version, title), items: readItems(value["items"]) });
}

/** Reads the metadata, taking each field only when the document typed it usably. */
function readFeed(source: Record<string, unknown>, version: string, title: string): JSONFeed.Feed {
	let feed: JSONFeed.Feed = { version, title };

	let homePageUrl = readString(source["home_page_url"]);
	if (homePageUrl) feed.homePageUrl = homePageUrl;

	let feedUrl = readString(source["feed_url"]);
	if (feedUrl) feed.feedUrl = feedUrl;

	let description = readString(source["description"]);
	if (description) feed.description = description;

	let userComment = readString(source["user_comment"]);
	if (userComment) feed.userComment = userComment;

	let nextUrl = readString(source["next_url"]);
	if (nextUrl) feed.nextUrl = nextUrl;

	let icon = readString(source["icon"]);
	if (icon) feed.icon = icon;

	let favicon = readString(source["favicon"]);
	if (favicon) feed.favicon = favicon;

	let authors = readAuthors(source["authors"]);
	if (authors) feed.authors = authors;

	let author = readAuthor(source["author"]);
	if (author) feed.author = author;

	let language = readString(source["language"]);
	if (language) feed.language = language;

	let expired = readBoolean(source["expired"]);
	if (expired !== undefined) feed.expired = expired;

	let hubs = readHubs(source["hubs"]);
	if (hubs) feed.hubs = hubs;

	for (let [key, extension] of extensionsOf(source)) feed[key] = extension;

	return feed;
}

/**
 * Reads the items, discarding any without an id: JSON Feed insists on that one
 * field, because an item a reader cannot recognize again reappears as a rerun.
 */
function readItems(source: unknown[]): JSONFeed.Item[] {
	let items: JSONFeed.Item[] = [];

	for (let entry of source) {
		if (!isRecord(entry)) continue;

		let id = readId(entry["id"]);
		if (!id) continue;

		items.push(readItem(entry, id));
	}

	return items;
}

/** Reads one item, taking each field only when the document typed it usably. */
function readItem(source: Record<string, unknown>, id: string): JSONFeed.Item {
	let item: JSONFeed.Item = { id };

	let url = readString(source["url"]);
	if (url) item.url = url;

	let externalUrl = readString(source["external_url"]);
	if (externalUrl) item.externalUrl = externalUrl;

	let title = readString(source["title"]);
	if (title) item.title = title;

	let contentHtml = readString(source["content_html"]);
	if (contentHtml) item.contentHtml = contentHtml;

	let contentText = readString(source["content_text"]);
	if (contentText) item.contentText = contentText;

	let summary = readString(source["summary"]);
	if (summary) item.summary = summary;

	let image = readString(source["image"]);
	if (image) item.image = image;

	let bannerImage = readString(source["banner_image"]);
	if (bannerImage) item.bannerImage = bannerImage;

	let datePublished = readString(source["date_published"]);
	if (datePublished) item.datePublished = datePublished;

	let dateModified = readString(source["date_modified"]);
	if (dateModified) item.dateModified = dateModified;

	let authors = readAuthors(source["authors"]);
	if (authors) item.authors = authors;

	let author = readAuthor(source["author"]);
	if (author) item.author = author;

	let tags = readStringArray(source["tags"]);
	if (tags) item.tags = tags;

	let language = readString(source["language"]);
	if (language) item.language = language;

	let attachments = readAttachments(source["attachments"]);
	if (attachments) item.attachments = attachments;

	for (let [key, extension] of extensionsOf(source)) item[key] = extension;

	return item;
}

/** Reads a list of authors, keeping those that name, link to, or picture someone. */
function readAuthors(value: unknown): JSONFeed.Author[] | undefined {
	if (!Array.isArray(value)) return undefined;

	let authors: JSONFeed.Author[] = [];
	for (let entry of value) {
		let author = readAuthor(entry);
		if (author) authors.push(author);
	}

	return authors.length > 0 ? authors : undefined;
}

/**
 * Reads one author. JSON Feed makes every field optional but requires at least
 * one, so an object carrying none reads as no author at all.
 */
function readAuthor(value: unknown): JSONFeed.Author | undefined {
	if (!isRecord(value)) return undefined;

	let author: JSONFeed.Author = {};

	let name = readString(value["name"]);
	if (name) author.name = name;

	let url = readString(value["url"]);
	if (url) author.url = url;

	let avatar = readString(value["avatar"]);
	if (avatar) author.avatar = avatar;

	return name || url || avatar ? author : undefined;
}

/** Reads the notification endpoints, which need both a protocol and an address. */
function readHubs(value: unknown): JSONFeed.Hub[] | undefined {
	if (!Array.isArray(value)) return undefined;

	let hubs: JSONFeed.Hub[] = [];
	for (let entry of value) {
		if (!isRecord(entry)) continue;

		let type = readString(entry["type"]);
		let url = readString(entry["url"]);
		if (type && url) hubs.push({ type, url });
	}

	return hubs.length > 0 ? hubs : undefined;
}

/**
 * Reads the attachments, keeping one that names no media type: a reader learns
 * that from the response when it downloads the file.
 */
function readAttachments(value: unknown): JSONFeed.Attachment[] | undefined {
	if (!Array.isArray(value)) return undefined;

	let attachments: JSONFeed.Attachment[] = [];

	for (let entry of value) {
		if (!isRecord(entry)) continue;

		let url = readString(entry["url"]);
		if (!url) continue;

		let attachment: JSONFeed.Attachment = { url };

		let mimeType = readString(entry["mime_type"]);
		if (mimeType) attachment.mimeType = mimeType;

		let title = readString(entry["title"]);
		if (title) attachment.title = title;

		let sizeInBytes = readNumber(entry["size_in_bytes"]);
		if (sizeInBytes !== undefined) attachment.sizeInBytes = sizeInBytes;

		let durationInSeconds = readNumber(entry["duration_in_seconds"]);
		if (durationInSeconds !== undefined) attachment.durationInSeconds = durationInSeconds;

		attachments.push(attachment);
	}

	return attachments.length > 0 ? attachments : undefined;
}
