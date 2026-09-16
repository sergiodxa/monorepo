/**
 * Pulls the article out of a web page: retrieves it under bounds an arbitrary origin
 * cannot spend, scores the page's containers to find the body, drops the furniture
 * around it, and sanitizes what is left before anybody can render it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { HTML } from "@sdxc/html";
import { parseDocument } from "@sdxc/html/document";
import { failure, isFailure, success } from "@sdxc/result";

import { addressable, MAX_BYTES, mayArchive, readWithin, retrieve } from "./lib/limits.js";
import { bylineOf, canonicalOf, titleOf } from "./lib/metadata.js";
import { isAllowed, robotsUrl } from "./lib/robots.js";
import { articleOf } from "./lib/score.js";
import { serialize } from "./lib/serialize.js";

export { addressable, MAX_BYTES, MAX_REDIRECTS, TIMEOUT_MS } from "./lib/limits.js";
export { isAllowed, productToken, robotsUrl } from "./lib/robots.js";

/**
 * Signals that the site said no: a status refusing the request, a `robots.txt`
 * disallowing the path, or an address this package will not ask for at all.
 */
export class ReadabilityRefusedError extends Error {
	override name = "ReadabilityRefusedError";
	readonly outcome = "refused" as const;
}

/**
 * Signals that the retrieval ran out of what it was allowed to spend — time, bytes,
 * or hops — which is the same thing to a reader however it was reached.
 */
export class ReadabilityLimitError extends Error {
	override name = "ReadabilityLimitError";
	readonly outcome = "timeout" as const;
}

/**
 * Signals that the page arrived and carried no article: a shell whose body a script
 * would have built, a document that is not markup, or a template holding nothing but
 * furniture.
 */
export class ReadabilityEmptyError extends Error {
	override name = "ReadabilityEmptyError";
	readonly outcome = "empty" as const;
}

/** Why an extraction produced nothing, carrying the outcome a reader is shown. */
export type ReadabilityError =
	| ReadabilityEmptyError
	| ReadabilityLimitError
	| ReadabilityRefusedError;

/** Groups the public types under a single import surface. */
export namespace Readability {
	/** What an attempt amounted to, which is the one thing a caller reports on. */
	export type Outcome = "empty" | "extracted" | "refused" | "timeout";

	/** An article as it came out of a page, ready to be rendered as it stands. */
	export interface Article {
		/** The body, sanitized, so no consumer can render markup this package did not clean. */
		html: string;
		title: string | null;
		byline: string | null;
		/** The address the article calls its own, which two paths onto it both reduce to. */
		url: string;
		/** Characters of readable text, which is what tells an article from a teaser. */
		chars: number;
	}

	/** An article, beside what retrieving it cost and what the response permits. */
	export interface Retrieved extends Article {
		/** Bytes read off the wire, which is the size the caps are spent against. */
		bytes: number;
		/**
		 * Whether the response permits this article being held for anybody else. A
		 * response carrying `X-Robots-Tag: noarchive` is read for whoever asked and
		 * kept for nobody.
		 */
		mayCache: boolean;
	}

	/** What a retrieval may spend, and the name it spends it under. */
	export interface Options {
		/**
		 * What the request names itself as. Required, because a publisher who wants to
		 * refuse should be able to tell who is asking, and only the caller knows what it
		 * is.
		 */
		userAgent: string;
		/**
		 * The origin's `robots.txt` as the caller already holds it, or `null` for an
		 * origin serving none. Omitted, the document is not consulted.
		 */
		robots?: string | null | undefined;
		maxBytes?: number | undefined;
		maxRedirects?: number | undefined;
		timeoutMs?: number | undefined;
		signal?: AbortSignal | undefined;
	}
}

/** The essence of a content type, which is the part a format is decided by. */
function essenceOf(response: Response): string {
	let declared = response.headers.get("content-type") ?? "";
	return declared.split(";").at(0)?.trim().toLowerCase() ?? "";
}

/**
 * Reads the article out of markup already in hand, sanitizing it before answering so
 * nothing downstream can render a publisher's own attributes.
 *
 * @param source - The page as it was served.
 * @param url - Where it came from, which every relative URL in it resolves against.
 * @returns The article, or why the page carried none.
 */
export function extractFrom(
	source: string,
	url: string,
): Result<Readability.Article, ReadabilityEmptyError> {
	let document = parseDocument(source);
	if (isFailure(document)) {
		return failure(new ReadabilityEmptyError(`Nothing to read at ${url}: it carried no markup`));
	}

	let body = articleOf(document.data);
	if (body === null) {
		return failure(new ReadabilityEmptyError(`Nothing to read at ${url}: it carried no article`));
	}

	let canonical = canonicalOf(document.data, url);

	let cleaned = HTML.sanitize(serialize(body), { baseUrl: canonical });
	if (isFailure(cleaned)) {
		return failure(new ReadabilityEmptyError(`Nothing to read at ${url}: the article was empty`));
	}

	let chars = (body.textContent ?? "").replaceAll(/\s+/gu, " ").trim().length;

	return success({
		html: cleaned.data,
		title: titleOf(document.data),
		byline: bylineOf(document.data),
		url: canonical,
		chars,
	});
}

/**
 * Retrieves a page and reads the article out of it.
 *
 * The request carries no credential and nothing identifying whoever asked for it,
 * and every bound it runs under is spent before the caller is answered, so a page
 * that will not end cannot hold a reader indefinitely.
 *
 * @param input - The article's address, as the post that linked it spelled it.
 * @param options - The name to ask under, what the retrieval may spend, and the
 * origin's `robots.txt` when the caller holds it.
 * @returns The article and what it cost, or why there is none.
 * @example let article = await extract(post.url, { userAgent: agent, robots });
 */
export async function extract(
	input: string,
	options: Readability.Options,
): Promise<Result<Readability.Retrieved, ReadabilityError>> {
	let address = addressable(input);
	if (isFailure(address)) return address;

	if (options.robots !== undefined) {
		let path = `${address.data.pathname}${address.data.search}`;
		if (!isAllowed(options.robots, path, options.userAgent)) {
			return failure(new ReadabilityRefusedError(`Refused ${input}: robots.txt disallows it`));
		}
	}

	let retrieved = await retrieve(address.data, options);
	if (isFailure(retrieved)) return retrieved;

	if (essenceOf(retrieved.data.response) !== "text/html") {
		void retrieved.data.response.body?.cancel().catch(() => undefined);
		return failure(new ReadabilityEmptyError(`Nothing to read at ${input}: it is not a page`));
	}

	let read = await readWithin(retrieved.data, options.maxBytes ?? MAX_BYTES);
	if (isFailure(read)) return read;

	let article = extractFrom(read.data.text, retrieved.data.url);
	if (isFailure(article)) return article;

	return success({
		...article.data,
		bytes: read.data.bytes,
		mayCache: mayArchive(retrieved.data.response),
	});
}

/**
 * Retrieves an origin's `robots.txt` for the caller to hold, answering `null` for an
 * origin that serves none — which permits everything, the way a missing document
 * always has.
 *
 * @param input - Any URL on the origin.
 * @param options - The name to ask under, and what the retrieval may spend.
 */
export async function fetchRobots(
	input: string,
	options: Readability.Options,
): Promise<string | null> {
	let address = addressable(input);
	if (isFailure(address)) return null;

	let retrieved = await retrieve(new URL(robotsUrl(address.data)), options);
	if (isFailure(retrieved)) return null;

	let read = await readWithin(retrieved.data, options.maxBytes ?? MAX_BYTES);
	if (isFailure(read)) return null;

	return read.data.text;
}
