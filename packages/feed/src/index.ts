/**
 * One feed API over both syndication formats. Sniffs a document's root element to
 * pick a parser, normalizes RSS and Atom into a single shape, and owns the two
 * concerns neither format package should carry: conditional requests and discovery.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { buildConditionalHeaders, readValidators } from "./lib/conditional.js";
import { discoverFeeds } from "./lib/discover.js";
import { fromAtom } from "./lib/from-atom.js";
import { fromRSS } from "./lib/from-rss.js";
import { sniff } from "./lib/sniff.js";

/** Raised when a document is a recognized format but cannot be read. */
export class FeedParseError extends Error {
	override name = "FeedParseError";
}

/** Raised when a document is not a syndication format this package reads. */
export class FeedFormatError extends Error {
	override name = "FeedFormatError";
}

/** Raised when a feed cannot be retrieved. */
export class FeedFetchError extends Error {
	override name = "FeedFetchError";
}

export namespace Feed {
	/** The syndication formats this package reads. */
	export type Format = "rss" | "atom";

	/** Whoever a post is attributed to. */
	export interface Author {
		name: string;
		url?: string;
		email?: string;
	}

	/** A file published alongside a post, such as a podcast episode. */
	export interface Enclosure {
		url: string;
		type?: string;
		length?: number;
	}

	/** One post, with the fields a reader renders. */
	export interface Item {
		/** Stable identity within the feed, always present; see the README's fallback chain. */
		guid: string;
		title?: string;
		url?: string;
		summary?: string;
		/** The body as HTML, unsanitized, exactly as the publisher wrote it. */
		contentHtml?: string;
		author?: Author;
		authors?: Author[];
		categories?: string[];
		enclosures?: Enclosure[];
		publishedAt?: Date;
		updatedAt?: Date;
	}

	/** A whole feed, normalized away from the format it arrived in. */
	export interface Data {
		format: Format;
		title: string;
		description?: string;
		siteUrl?: string;
		feedUrl?: string;
		language?: string;
		imageUrl?: string;
		updatedAt?: Date;
		items: Item[];
	}

	/** Options shared by every entry point that parses. */
	export interface ParseOptions {
		/** The document's own URL: the base for relative links, and the `feedUrl` fallback. */
		url?: string | URL;
	}

	/** Options for retrieving a feed. */
	export interface FetchOptions extends ParseOptions {
		/** The `ETag` a previous response carried, sent back as `If-None-Match`. */
		etag?: string | null;
		/** The `Last-Modified` a previous response carried, sent back as `If-Modified-Since`. */
		lastModified?: string | null;
		headers?: HeadersInit;
		signal?: AbortSignal;
	}

	/** What every retrieval reports regardless of whether the feed changed. */
	interface FetchedBase {
		/** The URL the response finally came from, after any redirect. */
		url: string;
		status: number;
		etag?: string;
		lastModified?: string;
	}

	/** A retrieval that returned a document. */
	export interface Fetched extends FetchedBase {
		notModified: false;
		feed: Feed;
	}

	/** A retrieval the origin answered with 304, leaving the stored copy current. */
	export interface NotModified extends FetchedBase {
		notModified: true;
		feed: undefined;
		status: 304;
	}

	/**
	 * The outcome of a retrieval, discriminated so a caller that checks
	 * `notModified` gets `feed` narrowed to defined on the other branch.
	 */
	export type FetchResult = Fetched | NotModified;

	/** A feed found while discovering what a URL publishes. */
	export interface Discovery {
		url: string;
		type: string;
		title?: string;
	}
}

/**
 * A feed, normalized away from the format it arrived in.
 *
 * Construct one through {@link Feed.parse}, {@link Feed.fromXML} or
 * {@link Feed.fetch} rather than directly, since only those know how to read a
 * document into this shape.
 */
export class Feed {
	#data: Feed.Data;

	/**
	 * Wraps already-normalized data.
	 *
	 * @param data - The normalized feed
	 */
	constructor(data: Feed.Data) {
		this.#data = data;
	}

	/** Which syndication format the document was written in. */
	get format(): Feed.Format {
		return this.#data.format;
	}

	/** The feed's title. */
	get title(): string {
		return this.#data.title;
	}

	/** The feed's description, when it carried one. */
	get description(): string | undefined {
		return this.#data.description;
	}

	/** The site the feed belongs to, for linking a reader back to the source. */
	get siteUrl(): string | undefined {
		return this.#data.siteUrl;
	}

	/** The feed's own address, as it declared it or as it was retrieved from. */
	get feedUrl(): string | undefined {
		return this.#data.feedUrl;
	}

	/** The feed's language, when it declared one. */
	get language(): string | undefined {
		return this.#data.language;
	}

	/** The feed's icon or logo, when it carried one. */
	get imageUrl(): string | undefined {
		return this.#data.imageUrl;
	}

	/** When the feed last changed, by its own reckoning. */
	get updatedAt(): Date | undefined {
		return this.#data.updatedAt;
	}

	/** The posts, in document order, deduplicated by `guid`. */
	get items(): Feed.Item[] {
		return this.#data.items;
	}

	/** The whole feed as plain data. */
	toJSON(): Feed.Data {
		return this.#data;
	}

	/**
	 * Reads a feed out of an already-parsed XML document, for a caller that parsed
	 * the text for some other purpose first.
	 *
	 * @param xml - The parsed XML document
	 * @param options - The document URL, used to resolve relative links
	 * @returns The feed, or the reason the document is not one
	 */
	static fromXML(
		xml: XML,
		options: Feed.ParseOptions = {},
	): Result<Feed, FeedParseError | FeedFormatError> {
		let format = sniff(xml);
		if (isFailure(format)) return format;

		let url = options.url === undefined ? undefined : String(options.url);
		let data = format.data === "atom" ? fromAtom(xml, url) : fromRSS(xml, url);
		if (isFailure(data)) return data;

		return success(new Feed(data.data));
	}

	/**
	 * Parses feed XML text in either format.
	 *
	 * @param source - The raw XML text
	 * @param options - The document URL, used to resolve relative links
	 * @returns The feed, or the reason the text is not one
	 */
	static parse(
		source: string,
		options: Feed.ParseOptions = {},
	): Result<Feed, FeedParseError | FeedFormatError> {
		let parsed = XML.parse(source);
		if (isFailure(parsed)) return failure(new FeedParseError(parsed.error.message));
		return Feed.fromXML(parsed.data, options);
	}

	/**
	 * Retrieves a feed, asking the origin to answer 304 when nothing changed.
	 *
	 * A 304 reports `notModified` without parsing anything, so a poller that
	 * stores the validators pays almost nothing for an unchanged feed. Because a
	 * 304 may legitimately omit them, the caller's own are carried forward.
	 *
	 * @param input - The feed's URL
	 * @param options - Stored validators, plus any additional request options
	 * @returns What the origin said, or the reason it could not be reached
	 */
	static async fetch(
		input: string | URL,
		options: Feed.FetchOptions = {},
	): Promise<Result<Feed.FetchResult, FeedFetchError | FeedParseError | FeedFormatError>> {
		let response: Response;
		try {
			response = await fetch(String(input), {
				headers: buildConditionalHeaders(options),
				signal: options.signal,
			});
		} catch (error) {
			return failure(new FeedFetchError(`Failed to fetch feed: ${describe(error)}`));
		}

		let url = response.url || String(input);
		let validators = readValidators(response, options);

		if (response.status === 304) {
			return success({ notModified: true, feed: undefined, status: 304, url, ...validators });
		}

		if (!response.ok) {
			return failure(new FeedFetchError(`Failed to fetch feed: ${response.status}`));
		}

		let text = await response.text();
		let feed = Feed.parse(text, { url: options.url ?? url });
		if (isFailure(feed)) return feed;

		return success({
			notModified: false,
			feed: feed.data,
			status: response.status,
			url,
			...validators,
		});
	}

	/**
	 * Finds the feeds a URL leads to.
	 *
	 * A URL that is itself a feed resolves without a second request. Anything else
	 * is read as HTML and its `<link rel="alternate">` elements are followed.
	 *
	 * @param input - A feed URL or the address of a page that advertises one
	 * @param options - Additional request options
	 * @returns The feeds found, in document order, or the reason none could be
	 */
	static async discover(
		input: string | URL,
		options: Feed.FetchOptions = {},
	): Promise<Result<Feed.Discovery[], FeedFetchError>> {
		let response: Response;
		try {
			response = await fetch(String(input), {
				headers: new Headers(options.headers),
				signal: options.signal,
			});
		} catch (error) {
			return failure(new FeedFetchError(`Failed to fetch ${String(input)}: ${describe(error)}`));
		}

		if (!response.ok) {
			return failure(new FeedFetchError(`Failed to fetch ${String(input)}: ${response.status}`));
		}

		let url = response.url || String(input);
		let text = await response.text();

		let parsed = XML.parse(text);
		if (!isFailure(parsed)) {
			let format = sniff(parsed.data);
			if (!isFailure(format)) {
				let type = format.data === "atom" ? "application/atom+xml" : "application/rss+xml";
				return success([{ url, type }]);
			}
		}

		return success(discoverFeeds(text, url));
	}
}

/**
 * Reads a thrown value's message, so a rejected request reports what went wrong
 * whether or not it rejected with an `Error`.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
