/**
 * JSON Feed 1.1 builder and parser. Holds a feed as the format's own fields, so
 * a document read into the class and written back out keeps every value it
 * carried, custom extension objects included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { buildDocument } from "./lib/build-document.js";
import { MEDIA_TYPE, VERSION, VERSION_PREFIX } from "./lib/constants.js";
import { parseFeed } from "./lib/parse-feed.js";
import { isRecord, readString } from "./lib/utils.js";
import { validateFeed } from "./lib/validate-feed.js";
import { validateItem } from "./lib/validate-item.js";

/** Raised when a value is not a usable JSON Feed document. */
export class JSONFeedParseError extends Error {
	override name = "JSONFeedParseError";
}

/** Raised when a feed cannot be retrieved. */
export class JSONFeedFetchError extends Error {
	override name = "JSONFeedFetchError";
}

export namespace JSONFeed {
	/**
	 * A publisher extension's name. JSON Feed reserves a leading underscore for
	 * them, so a field named this way can never collide with a future version's.
	 */
	export type ExtensionKey = `_${string}`;

	/** A person a feed or an item is attributed to. At least one field is required. */
	export interface Author {
		name?: string;
		url?: string;
		/** A square image of the author, large enough to survive a retina display. */
		avatar?: string;
	}

	/** An endpoint that pushes a notification when the feed changes. */
	export interface Hub {
		/** The protocol the endpoint speaks, such as `WebSub` or `rssCloud`. */
		type: string;
		url: string;
	}

	/** A file published alongside an item, such as a podcast episode. */
	export interface Attachment {
		url: string;
		/**
		 * The file's media type, such as `audio/mpeg`. JSON Feed asks for one and
		 * tells a reader to carry on without it, since the download reports it too.
		 */
		mimeType?: string;
		/** Attachments sharing a title are alternate representations of one thing. */
		title?: string;
		sizeInBytes?: number;
		durationInSeconds?: number;
	}

	/** Feed-level metadata, with extensions written inline beside the defined fields. */
	export interface Feed {
		/** The version URL the document declared, defaulting to JSON Feed 1.1. */
		version?: string;
		title: string;
		/** The HTML page the feed describes. */
		homePageUrl?: string;
		/** The feed's own address, which also serves as its unique identifier. */
		feedUrl?: string;
		description?: string;
		/** A note addressed to whoever opens the raw JSON, which readers ignore. */
		userComment?: string;
		/** The next page of items, for a publisher that paginates a long feed. */
		nextUrl?: string;
		/** A large square image, used the way an avatar is. */
		icon?: string;
		/** A small square image, used in a source list. */
		favicon?: string;
		authors?: Author[];
		/** JSON Feed 1.0's single author, kept so a 1.0 document round-trips. */
		author?: Author;
		/** The feed's primary language as an RFC 5646 tag, such as `en-US`. */
		language?: string;
		/** `true` when the feed has published everything it ever will. */
		expired?: boolean;
		hubs?: Hub[];
		[extension: ExtensionKey]: unknown;
	}

	/**
	 * One item. JSON Feed asks for `contentHtml` or `contentText`, and insists only
	 * on `id`, which is what a reader needs to recognize the item again.
	 */
	export interface Item {
		id: string;
		/** The item's permalink. */
		url?: string;
		/** For a linkblog, the page being written about. */
		externalUrl?: string;
		title?: string;
		contentHtml?: string;
		contentText?: string;
		/** A plain-text sentence or two, for a timeline that shows no body. */
		summary?: string;
		/** The item's featured image, which a reader may show as a thumbnail. */
		image?: string;
		/** A wide image for the top of a detail view. */
		bannerImage?: string;
		/** An RFC 3339 timestamp, such as `2026-02-07T14:04:00-05:00`. */
		datePublished?: string;
		/** An RFC 3339 timestamp recording the last edit. */
		dateModified?: string;
		authors?: Author[];
		/** JSON Feed 1.0's single author, kept so a 1.0 document round-trips. */
		author?: Author;
		/** Free-form terms, called categories by the other syndication formats. */
		tags?: string[];
		/** This item's language, when it differs from the feed's. */
		language?: string;
		attachments?: Attachment[];
		[extension: ExtensionKey]: unknown;
	}

	/**
	 * A whole feed as JSON Feed writes it, keys and all, which is what
	 * `JSON.stringify` receives and therefore exactly the document a publisher serves.
	 */
	export interface Document {
		version: string;
		title: string;
		home_page_url?: string;
		feed_url?: string;
		description?: string;
		user_comment?: string;
		next_url?: string;
		icon?: string;
		favicon?: string;
		authors?: Author[];
		author?: Author;
		language?: string;
		expired?: boolean;
		hubs?: Hub[];
		items: DocumentItem[];
		[extension: ExtensionKey]: unknown;
	}

	/** One item as JSON Feed writes it. */
	export interface DocumentItem {
		id: string;
		url?: string;
		external_url?: string;
		title?: string;
		content_html?: string;
		content_text?: string;
		summary?: string;
		image?: string;
		banner_image?: string;
		date_published?: string;
		date_modified?: string;
		authors?: Author[];
		author?: Author;
		tags?: string[];
		language?: string;
		attachments?: DocumentAttachment[];
		[extension: ExtensionKey]: unknown;
	}

	/** One attachment as JSON Feed writes it. */
	export interface DocumentAttachment {
		url: string;
		mime_type?: string;
		title?: string;
		size_in_bytes?: number;
		duration_in_seconds?: number;
	}
}

/**
 * A JSON Feed 1.1 document, holding feed-level metadata and an ordered list of
 * items.
 *
 * Reading accessors hand back clones, so a caller cannot reach into the instance
 * by mutating what it returned.
 */
export class JSONFeed {
	/** The media type a JSON Feed is served under. */
	static readonly mediaType = MEDIA_TYPE;

	#feed: JSONFeed.Feed;
	#items: JSONFeed.Item[] = [];

	/**
	 * Builds a feed from its metadata, starting with no items.
	 *
	 * @param feed - The feed-level metadata
	 * @throws JSONFeedParseError When the title is missing
	 */
	constructor(feed: JSONFeed.Feed) {
		validateFeed(feed);
		this.#feed = structuredClone(feed);
	}

	/** The feed-level metadata. */
	get feed(): JSONFeed.Feed {
		return structuredClone(this.#feed);
	}

	/**
	 * Replaces the feed-level metadata, leaving the items in place.
	 *
	 * @throws JSONFeedParseError When the title is missing
	 */
	set feed(feed: JSONFeed.Feed) {
		validateFeed(feed);
		this.#feed = structuredClone(feed);
	}

	/** The version URL this feed declares, which a built feed takes from the package. */
	get version(): string {
		return this.#feed.version ?? VERSION;
	}

	/** The items, in the order they were added. */
	get items(): JSONFeed.Item[] {
		return structuredClone(this.#items);
	}

	/**
	 * Appends one item.
	 *
	 * @param item - The item to append
	 * @throws JSONFeedParseError When the id is missing
	 */
	addItem(item: JSONFeed.Item): void {
		validateItem(item);
		this.#items.push(structuredClone(item));
	}

	/**
	 * Removes the first item carrying an id, which JSON Feed makes unique within a
	 * feed over time, so at most one item can match.
	 *
	 * @param id - The item id to remove
	 */
	removeItem(id: string): void {
		let index = this.#items.findIndex((item) => item.id === id);
		if (index === -1) return;
		this.#items.splice(index, 1);
	}

	/**
	 * The feed as a JSON Feed document: the fields in the order the format lists
	 * them, without the ones this feed left empty.
	 */
	toJSON(): JSONFeed.Document {
		return buildDocument(this.#feed, this.#items);
	}

	/** Serializes the feed into JSON Feed 1.1 text. */
	toString(): string {
		return JSON.stringify(this.toJSON());
	}

	/**
	 * Reads the JSON Feed version a value declares.
	 *
	 * The version URL is the only field that separates a feed from any other JSON
	 * a URL might serve, which makes this the way to recognize one.
	 *
	 * @param value - The value to inspect
	 * @returns The declared version URL, or `undefined` when the value declares none
	 */
	static version(value: unknown): string | undefined {
		if (!isRecord(value)) return undefined;

		let version = readString(value["version"]);
		if (version?.startsWith(VERSION_PREFIX)) return version;
		return undefined;
	}

	/**
	 * Reads a feed out of an already-parsed JSON value, which is the entry point
	 * for a caller that parsed the text for some other purpose first.
	 *
	 * @param value - The parsed JSON value
	 * @returns The feed, or the reason the value is not one
	 */
	static fromJSON(value: unknown): Result<JSONFeed, JSONFeedParseError> {
		let document = parseFeed(value);
		if (isFailure(document)) return document;

		let feed = new JSONFeed(document.data.feed);
		for (let item of document.data.items) feed.addItem(item);
		return success(feed);
	}

	/**
	 * Parses JSON Feed text.
	 *
	 * @param source - The raw JSON text
	 * @returns The feed, or the reason the text is not one
	 */
	static parse(source: string): Result<JSONFeed, JSONFeedParseError> {
		let value: unknown;
		try {
			value = JSON.parse(source);
		} catch (error) {
			return failure(new JSONFeedParseError(`Failed to parse JSON: ${message(error)}`));
		}

		return JSONFeed.fromJSON(value);
	}

	/**
	 * Retrieves a feed and parses it.
	 *
	 * The request asks for `application/feed+json` while accepting `application/json`,
	 * which is what many publishers serve a feed as.
	 *
	 * @param input - The URL or request to retrieve
	 * @param init - Additional request options
	 * @returns The feed, or the reason it could not be read
	 */
	static async fetch(
		input: URL | RequestInfo,
		init?: RequestInit,
	): Promise<Result<JSONFeed, JSONFeedFetchError | JSONFeedParseError>> {
		let headers = new Headers(init?.headers);
		if (!headers.has("accept")) headers.set("accept", `${MEDIA_TYPE}, application/json`);

		let response: Response;
		try {
			response = await fetch(input, { ...init, headers });
		} catch (error) {
			return failure(new JSONFeedFetchError(`Failed to fetch JSON Feed: ${message(error)}`));
		}

		if (!response.ok) {
			return failure(new JSONFeedFetchError(`Failed to fetch JSON Feed: ${response.status}`));
		}

		let text = await response.text();
		return JSONFeed.parse(text);
	}
}

/**
 * Reads a thrown value's message, so a rejected request reports what went wrong
 * whether or not it rejected with an `Error`.
 */
function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
