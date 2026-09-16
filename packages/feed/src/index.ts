/**
 * One feed API over every syndication format. Sniffs a document to pick a parser,
 * normalizes RSS, Atom and JSON Feed into a single shape, and owns the two
 * concerns no format package should carry: conditional requests and discovery.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { buildConditionalHeaders, readValidators } from "./lib/conditional.js";
import { discoverFeeds, JSON_FEED_TYPE, mediaTypeOf } from "./lib/discover.js";
import { fromAtom } from "./lib/from-atom.js";
import { fromJSONFeed } from "./lib/from-json-feed.js";
import { fromRSS } from "./lib/from-rss.js";
import { readWithin, retrieve } from "./lib/limits.js";
import { fromLinkHeader, selectHub } from "./lib/links.js";
import { looksLikeJSON, sniff } from "./lib/sniff.js";
import { describe } from "./lib/utils.js";

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

/**
 * Raised when an origin answers with more than a retrieval allows: a body past
 * the size cap, or a redirect chain past its limit. It is a `FeedFetchError`, so
 * matching on that catches it too, and its own type tells a publisher this
 * package refused from one it could not reach.
 */
export class FeedLimitError extends FeedFetchError {
	override name = "FeedLimitError";
}

export namespace Feed {
	/** The syndication formats this package reads. */
	export type Format = "rss" | "atom" | "json";

	/** Whoever a post is attributed to. */
	export interface Author {
		name: string;
		url?: string;
		email?: string;
	}

	/**
	 * One relation a document or a response declared, with `rel` lower-cased and
	 * `href` resolved against the document it was read from.
	 */
	export interface Link {
		rel: string;
		href: string;
		type?: string;
	}

	/** A push endpoint, beside which of the two places advertised it. */
	export interface Hub {
		url: string;
		/** `header` when the response's own `Link` header named it, `document` otherwise. */
		source: "header" | "document";
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
		/** The body as plain text, which rendering as markup means escaping first. */
		contentText?: string;
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
		/**
		 * Every relation the document declared, in document order. `feedUrl` is the
		 * `self` relation already resolved, so a caller that only wants the address
		 * reads that instead of filtering this.
		 */
		links?: Link[];
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
		/** How many bytes of the response to read before refusing it; 10 MiB by default. */
		maxBytes?: number;
		/** How many redirects to follow before refusing the chain; five by default. */
		maxRedirects?: number;
	}

	/** What every retrieval reports regardless of whether the feed changed. */
	interface FetchedBase {
		/** The URL the response finally came from, after any redirect. */
		url: string;
		status: number;
		etag?: string;
		lastModified?: string;
		/**
		 * The relations the response's own `Link` header declared, which outrank the
		 * document's wherever a publisher can set a header but not edit their feed.
		 */
		links?: Link[];
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

	/**
	 * Every relation the document declared, in document order, with each `rel`
	 * lower-cased and each `href` resolved. It is what a caller reads a relation the
	 * accessors above do not cover — `hub`, say — out of, whichever format the
	 * document arrived in.
	 */
	get links(): Feed.Link[] {
		return this.#data.links ?? [];
	}

	/**
	 * The hub to subscribe to, preferring the one the response's own `Link` header
	 * named, since a publisher on a hosted platform can set a header where they
	 * cannot edit the document. A hub reached over anything but `https:` is passed
	 * over, because a subscription carries a shared secret in a request body.
	 *
	 * @param header - The relations the response's `Link` header declared
	 * @param document - The relations the document declared
	 * @returns The hub and where it was advertised, or nothing when there is none
	 * @example let hub = Feed.selectHub(fetched.links, fetched.feed.links);
	 */
	static selectHub(
		header?: readonly Feed.Link[],
		document?: readonly Feed.Link[],
	): Feed.Hub | undefined {
		return selectHub(header, document);
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
	 * Reads a feed out of an already-parsed JSON value, for a caller that parsed
	 * the text for some other purpose first.
	 *
	 * @param value - The parsed JSON value
	 * @param options - The document URL, used to resolve relative links
	 * @returns The feed, or the reason the value is not one
	 */
	static fromJSON(
		value: unknown,
		options: Feed.ParseOptions = {},
	): Result<Feed, FeedParseError | FeedFormatError> {
		let url = options.url === undefined ? undefined : String(options.url);

		let data = fromJSONFeed(value, url);
		if (isFailure(data)) return data;

		return success(new Feed(data.data));
	}

	/**
	 * Parses feed text in any format this package reads.
	 *
	 * @param source - The raw feed text, JSON or XML
	 * @param options - The document URL, used to resolve relative links
	 * @returns The feed, or the reason the text is not one
	 */
	static parse(
		source: string,
		options: Feed.ParseOptions = {},
	): Result<Feed, FeedParseError | FeedFormatError> {
		if (looksLikeJSON(source)) {
			let value: unknown;
			try {
				value = JSON.parse(source);
			} catch (error) {
				return failure(new FeedParseError(`Failed to parse JSON: ${describe(error)}`));
			}

			return Feed.fromJSON(value, options);
		}

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
	 * A URL comes from whoever pasted it, so the retrieval is bounded on both
	 * sides: a body is read off the stream up to `maxBytes`, and a chain is
	 * followed up to `maxRedirects`. Either bound reports a {@link FeedLimitError}.
	 *
	 * @param input - The feed's URL
	 * @param options - Stored validators, plus any additional request options
	 * @returns What the origin said, or the reason it could not be reached
	 */
	static async fetch(
		input: string | URL,
		options: Feed.FetchOptions = {},
	): Promise<Result<Feed.FetchResult, FeedFetchError | FeedParseError | FeedFormatError>> {
		let retrieved = await retrieve(String(input), buildConditionalHeaders(options), options);
		if (isFailure(retrieved)) return retrieved;

		let { response, url } = retrieved.data;
		let validators = readValidators(response, options);
		let links = fromLinkHeader(response, url);

		if (response.status === 304) {
			return success({
				notModified: true,
				feed: undefined,
				status: 304,
				url,
				links,
				...validators,
			});
		}

		if (!response.ok) {
			return failure(new FeedFetchError(`Failed to fetch feed: ${response.status}`));
		}

		let body = await readWithin(retrieved.data, options);
		if (isFailure(body)) return body;

		let feed = Feed.parse(body.data, { url: options.url ?? url });
		if (isFailure(feed)) return feed;

		return success({
			notModified: false,
			feed: feed.data,
			status: response.status,
			url,
			links,
			...validators,
		});
	}

	/**
	 * Finds the feeds a URL leads to.
	 *
	 * A URL that is itself a feed resolves without a second request. Anything else
	 * is read as HTML and its `<link rel="alternate">` elements are followed.
	 *
	 * Among the JSON candidates a page advertises, `application/feed+json` wins
	 * outright: `application/json` is what a page uses for anything at all, and is
	 * taken as a feed only when the page names no better-typed one.
	 *
	 * The retrieval is bounded the way {@link Feed.fetch}'s is, and each feed is
	 * reported at the URL its response finally came from, so a caller that keys a
	 * feed by address stores where the chain ended rather than where it started.
	 *
	 * @param input - A feed URL or the address of a page that advertises one
	 * @param options - Additional request options
	 * @returns The feeds found, in document order, or the reason none could be
	 */
	static async discover(
		input: string | URL,
		options: Feed.FetchOptions = {},
	): Promise<Result<Feed.Discovery[], FeedFetchError>> {
		let retrieved = await retrieve(String(input), new Headers(options.headers), options);
		if (isFailure(retrieved)) return retrieved;

		let { response, url } = retrieved.data;

		if (!response.ok) {
			return failure(new FeedFetchError(`Failed to fetch ${String(input)}: ${response.status}`));
		}

		let body = await readWithin(retrieved.data, options);
		if (isFailure(body)) return body;

		let text = body.data;

		if (looksLikeJSON(text)) {
			let feed = Feed.parse(text, { url });
			if (!isFailure(feed)) return success([{ url, type: JSON_FEED_TYPE }]);
			return success([]);
		}

		let parsed = XML.parse(text);
		if (!isFailure(parsed)) {
			let format = sniff(parsed.data);
			if (!isFailure(format)) return success([{ url, type: mediaTypeOf(format.data) }]);
		}

		return success(discoverFeeds(text, url));
	}
}
