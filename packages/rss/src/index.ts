/**
 * Builds, parses, and serializes RSS 2.0 feeds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { buildDocument } from "./lib/build-document.js";
import { cloneChannel, cloneItem } from "./lib/clone.js";
import { parseFeed } from "./lib/parse-feed.js";
import { getGuidValue } from "./lib/utils.js";
import { validateChannel } from "./lib/validate-channel.js";
import { validateItem } from "./lib/validate-item.js";

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

	/**
	 * Represents the plain serializable shape returned by `toJSON()`.
	 */
	export interface Feed {
		channel: Channel;
		items: Item[];
	}
}

/**
 * Builds, parses, and serializes RSS 2.0 feeds with XML-backed round-tripping.
 */
export class RSS {
	#channel: RSS.Channel;
	#items: RSS.Item[];

	/**
	 * Stores one RSS channel definition and starts with an empty item list.
	 *
	 * @param channel - The channel metadata for the feed
	 */
	constructor(channel: RSS.Channel) {
		validateChannel(channel);
		this.#channel = cloneChannel(channel);
		this.#items = [];
	}

	/**
	 * Exposes the channel data as a clone so callers cannot mutate internals.
	 */
	get channel(): RSS.Channel {
		return cloneChannel(this.#channel);
	}

	/**
	 * Replaces the current channel definition after validating required fields.
	 *
	 * @param channel - The next channel value
	 */
	set channel(channel: RSS.Channel) {
		validateChannel(channel);
		this.#channel = cloneChannel(channel);
	}

	/**
	 * Exposes the item list as clones so callers cannot mutate internals.
	 */
	get items(): RSS.Item[] {
		return this.#items.map(cloneItem);
	}

	/**
	 * Appends one item to the feed.
	 *
	 * @param item - The item to append
	 */
	addItem(item: RSS.Item): void {
		validateItem(item);
		this.#items.push(cloneItem(item));
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

	/**
	 * Returns the feed as plain serializable data.
	 */
	toJSON(): RSS.Feed {
		return {
			channel: cloneChannel(this.#channel),
			items: this.#items.map(cloneItem),
		};
	}

	/**
	 * Serializes the current feed into RSS 2.0 XML.
	 */
	toString(): string {
		let result = XML.stringify(new XML(buildDocument(this.#channel, this.#items)));
		if (isFailure(result)) throw result.error;
		return result.data;
	}

	/**
	 * Extracts one RSS feed from a parsed XML instance.
	 *
	 * @param xml - The parsed XML document
	 * @returns The extracted feed
	 */
	static fromXML(xml: XML): RSS {
		let feed = parseFeed(xml);
		if (isFailure(feed)) throw feed.error;

		let rss = new RSS(feed.data.channel);
		for (let item of feed.data.items) rss.addItem(item);
		return rss;
	}

	/**
	 * Parses raw RSS XML into an `RSS` instance.
	 *
	 * @param source - Raw RSS XML text
	 * @returns The parsed feed
	 */
	static parse(source: string): RSS {
		let parsed = XML.parse(source);
		if (isFailure(parsed)) throw parsed.error;
		return RSS.fromXML(parsed.data);
	}

	/**
	 * Fetches RSS XML and parses it into an `RSS` instance.
	 *
	 * @param input - The URL or request info to fetch
	 * @param init - Additional fetch options
	 * @returns The parsed feed
	 */
	static async fetch(input: URL | RequestInfo, init?: RequestInit): Promise<RSS> {
		let headers = new Headers(init?.headers);
		headers.set("cache-control", "no-cache, no-store");

		let response = await fetch(input, { ...init, headers });
		if (!response.ok) throw new Error("Failed to fetch RSS feed");

		let contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
		if (!contentType.includes("xml")) throw new Error("Invalid Content-Type");

		let text = await response.text();
		return RSS.parse(text);
	}
}
