/**
 * Builds, parses, and serializes RSS 2.0 feeds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { buildDocument } from "./lib/build-document.js";
import { cloneChannel, cloneItem } from "./lib/clone.js";
import { parseFeed } from "./lib/parse-feed.js";
import { getGuidValue } from "./lib/utils.js";
import { validateChannel } from "./lib/validate-channel.js";
import { validateItem } from "./lib/validate-item.js";

/** Raised when a document or in-memory data is not a usable RSS 2.0 feed. */
export class RSSParseError extends Error {
	override name = "RSSParseError";
}

/** Raised when a feed cannot be retrieved or does not arrive as XML. */
export class RSSFetchError extends Error {
	override name = "RSSFetchError";
}

/** Raised when in-memory feed data cannot be serialized to XML. */
export class RSSStringifyError extends Error {
	override name = "RSSStringifyError";
}

/**
 * Groups the public RSS types under a single import surface.
 */
export namespace RSS {
	/**
	 * Mirrors one extension element that should round-trip through RSS XML.
	 */
	export interface Element {
		name: string;
		attributes?: Record<string, string>;
		children?: Node[];
	}

	/**
	 * Allows extension elements to mix plain text and nested elements.
	 */
	export type Node = string | Element;

	/**
	 * Stores a category value with its optional taxonomy domain.
	 */
	export interface Category {
		value: string;
		domain?: string;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Accepts either a plain category string or its structured form.
	 */
	export type CategoryInput = string | Category;

	/**
	 * Stores the rssCloud endpoint used to request update notifications.
	 */
	export interface Cloud {
		domain: string;
		port: number;
		path: string;
		registerProcedure: string;
		protocol: string;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Stores one image payload attached to the channel.
	 */
	export interface Image {
		url: string;
		title: string;
		link: string;
		description?: string;
		width?: number;
		height?: number;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Stores one textInput payload attached to the channel.
	 */
	export interface TextInput {
		title: string;
		description: string;
		name: string;
		link: string;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Stores one Atom link extension.
	 */
	export interface AtomLink {
		href: string;
		rel?: string;
		type?: string;
		hreflang?: string;
		title?: string;
		length?: number;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Accepts either one Atom link or many of them.
	 */
	export type AtomLinkInput = AtomLink | AtomLink[];

	/**
	 * Stores one enclosure attached to an item.
	 */
	export interface Enclosure {
		url: string;
		length: number;
		type: string;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Accepts either one enclosure or a list of them.
	 */
	export type EnclosureInput = Enclosure | Enclosure[];

	/**
	 * Stores one guid with its optional permalink hint.
	 */
	export interface Guid {
		value: string;
		isPermaLink?: boolean;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Accepts either a plain guid string or its structured form.
	 */
	export type GuidInput = string | Guid;

	/**
	 * Stores the source feed metadata for a republished item.
	 */
	export interface Source {
		value: string;
		url: string;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Stores the channel metadata defined by RSS 2.0 and common namespace extensions.
	 */
	export interface Channel {
		title: string;
		description: string;
		link: string;
		language?: string;
		copyright?: string;
		managingEditor?: string;
		webMaster?: string;
		pubDate?: string;
		lastBuildDate?: string;
		category?: CategoryInput | CategoryInput[];
		generator?: string;
		docs?: string;
		cloud?: Cloud;
		ttl?: number;
		image?: Image;
		rating?: string;
		textInput?: TextInput;
		skipHours?: number[];
		skipDays?: string[];
		atomLink?: AtomLinkInput;
		dcCreator?: string | string[];
		/**
		 * The channel lists every item of the feed (`fh:complete`, RFC 5005 §2), so an item
		 * missing from it has left the feed.
		 */
		fhComplete?: boolean;
		/**
		 * The channel is an archive (`fh:archive`, RFC 5005 §4): a fixed page of older items
		 * reached through an `atom:link` with `rel="prev-archive"`.
		 */
		fhArchive?: boolean;
		namespaces?: Record<string, string>;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Stores one RSS item together with common namespace extensions.
	 */
	export interface ItemBase {
		guid?: GuidInput;
		title?: string;
		description?: string;
		link?: string;
		author?: string;
		category?: CategoryInput | CategoryInput[];
		comments?: string;
		enclosure?: EnclosureInput;
		pubDate?: string;
		source?: Source;
		contentEncoded?: string;
		atomLink?: AtomLinkInput;
		dcCreator?: string | string[];
		slashComments?: number;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/**
	 * Stores one RSS item and requires at least a title or description.
	 */
	export type Item = ItemBase & ({ title: string } | { description: string });

	/** A whole feed as plain data: the shape `toJSON()` returns and `RSS.fromJSON` accepts. */
	export interface Feed {
		channel: Channel;
		items: Item[];
	}
}

/**
 * An RSS 2.0 feed, holding channel metadata and an ordered list of items.
 *
 * Every way in validates what RSS 2.0 requires, so an instance always holds a
 * feed that serializes; reading accessors hand back clones the caller may mutate.
 */
export class RSS {
	#channel: RSS.Channel;
	#items: RSS.Item[];

	/** Takes ownership of already-validated data, so callers pass clones. */
	private constructor(channel: RSS.Channel, items: RSS.Item[]) {
		this.#channel = channel;
		this.#items = items;
	}

	/** The channel metadata. */
	get channel(): RSS.Channel {
		return cloneChannel(this.#channel);
	}

	/** The items, in the order they were added. */
	get items(): RSS.Item[] {
		return this.#items.map(cloneItem);
	}

	/**
	 * Replaces the channel metadata, leaving the items in place. A refused channel
	 * leaves the instance unchanged.
	 *
	 * @param channel - The new channel metadata
	 * @returns An error when the title, description or link is missing
	 */
	setChannel(channel: RSS.Channel): Result<void, RSSParseError> {
		let valid = validateChannel(channel);
		if (isFailure(valid)) return valid;
		this.#channel = cloneChannel(channel);
		return success(undefined);
	}

	/**
	 * Appends one item. A refused item leaves the instance unchanged.
	 *
	 * @param item - The item to append
	 * @returns An error when the item has neither a title nor a description
	 */
	addItem(item: RSS.Item): Result<void, RSSParseError> {
		let valid = validateItem(item);
		if (isFailure(valid)) return valid;
		this.#items.push(cloneItem(item));
		return success(undefined);
	}

	/**
	 * Removes the first item whose guid value matches the provided identifier.
	 *
	 * @param guid - The guid value to remove
	 */
	removeItem(guid: string): void {
		let index = this.#items.findIndex((item) => getGuidValue(item) === guid);
		if (index >= 0) this.#items.splice(index, 1);
	}

	/** The channel and its items as plain, serializable data. */
	toJSON(): RSS.Feed {
		return {
			channel: cloneChannel(this.#channel),
			items: this.#items.map(cloneItem),
		};
	}

	/**
	 * Builds a feed from plain data, the shape `toJSON` returns.
	 *
	 * @param feed - The channel metadata and its items, in order
	 * @returns The feed, or an error naming the first requirement the channel or an
	 * item misses
	 * @example RSS.fromJSON({ channel: { title, description, link }, items: [] })
	 */
	static fromJSON(feed: RSS.Feed): Result<RSS, RSSParseError> {
		let channel = validateChannel(feed.channel);
		if (isFailure(channel)) return channel;

		for (let item of feed.items) {
			let valid = validateItem(item);
			if (isFailure(valid)) return valid;
		}

		return success(new RSS(cloneChannel(feed.channel), feed.items.map(cloneItem)));
	}

	/**
	 * Serializes a feed into RSS 2.0 XML. Plain data is validated first, so one call
	 * builds and writes a feed.
	 *
	 * @param input - A feed instance, or the plain data `RSS.fromJSON` accepts
	 * @returns The XML text, an `RSSParseError` when plain data misses a requirement,
	 * or an `RSSStringifyError` when a name or value cannot be written as XML
	 * @example RSS.stringify({ channel: { title, description, link }, items })
	 */
	static stringify(input: RSS | RSS.Feed): Result<string, RSSParseError | RSSStringifyError> {
		let rss = input instanceof RSS ? success(input) : RSS.fromJSON(input);
		if (isFailure(rss)) return rss;

		let result = XML.stringify(new XML(buildDocument(rss.data.#channel, rss.data.#items)));
		if (isFailure(result)) return failure(new RSSStringifyError(result.error.message));
		return result;
	}

	/**
	 * Reads a feed out of an already-parsed XML document, which is the entry point
	 * for a caller that parsed the text for some other purpose first.
	 *
	 * @param xml - The parsed XML document
	 * @returns The feed, or the reason the document is not one
	 */
	static fromXML(xml: XML): Result<RSS, RSSParseError> {
		let feed = parseFeed(xml);
		if (isFailure(feed)) return failure(new RSSParseError(feed.error.message));
		return success(new RSS(feed.data.channel, feed.data.items));
	}

	/**
	 * Parses RSS XML text.
	 *
	 * @param source - The raw XML text
	 * @returns The feed, or the reason the text is not one
	 */
	static parse(source: string): Result<RSS, RSSParseError> {
		let parsed = XML.parse(source);
		if (isFailure(parsed)) return failure(new RSSParseError(parsed.error.message));
		return RSS.fromXML(parsed.data);
	}

	/**
	 * Retrieves a feed, bypassing caches, and parses it.
	 *
	 * @param input - The URL or request to retrieve
	 * @param init - Additional request options
	 * @returns The feed, or the reason it could not be read: an `RSSFetchError` when
	 * the request fails or the response is not XML
	 */
	static async fetch(
		input: URL | RequestInfo,
		init?: RequestInit,
	): Promise<Result<RSS, RSSFetchError | RSSParseError>> {
		let headers = new Headers(init?.headers);
		headers.set("cache-control", "no-cache, no-store");

		let response: Response;
		try {
			response = await fetch(input, { ...init, headers });
		} catch (error) {
			return failure(new RSSFetchError(`Failed to fetch RSS feed: ${message(error)}`));
		}

		if (!response.ok) {
			return failure(new RSSFetchError(`Failed to fetch RSS feed: ${response.status}`));
		}

		let contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
		if (!contentType.includes("xml")) {
			return failure(new RSSFetchError(`Expected an XML response, received "${contentType}".`));
		}

		let text = await response.text();
		return RSS.parse(text);
	}
}

/**
 * Reads a thrown value's message, so a rejected request reports what went wrong
 * whether or not it rejected with an `Error`.
 */
function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
