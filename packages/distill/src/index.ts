/**
 * Pulls the article out of a web page: retrieves it under bounds an arbitrary origin
 * cannot spend, scores the page's containers to find the body, drops the furniture
 * around it, and sanitizes what is left before anybody can render it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { RobotsFetch } from "@sdxc/robots/fetch";

import { HTML } from "@sdxc/html";
import { parseDocument } from "@sdxc/html/document";
import { readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";
import { directivesFor } from "@sdxc/robots/directives";
import { isAllowedBy } from "@sdxc/robots/fetch";

import { addressable, MAX_BYTES, retrieve, toDistillError } from "./lib/limits.js";
import { bylineOf, canonicalOf, titleOf } from "./lib/metadata.js";
import { articleOf } from "./lib/score.js";
import { serialize } from "./lib/serialize.js";

export { addressable, MAX_BYTES, MAX_REDIRECTS, TIMEOUT_MS } from "./lib/limits.js";

/**
 * Signals that the site said no: a status refusing the request, a `robots.txt`
 * disallowing the path, or an address this package will not ask for at all.
 */
export class DistillRefusedError extends Error {
	override name = "DistillRefusedError";
	readonly outcome = "refused" as const;
}

/**
 * Signals that the retrieval ran out of what it was allowed to spend — time, bytes,
 * or hops — which is the same thing to a reader however it was reached.
 */
export class DistillLimitError extends Error {
	override name = "DistillLimitError";
	readonly outcome = "timeout" as const;
}

/**
 * Signals that the page arrived and carried no article: a shell whose body a script
 * would have built, a document that is not markup, or a template holding nothing but
 * furniture.
 */
export class DistillEmptyError extends Error {
	override name = "DistillEmptyError";
	readonly outcome = "empty" as const;
}

/** Why a distillation produced nothing, carrying the outcome a reader is shown. */
export type DistillError = DistillEmptyError | DistillLimitError | DistillRefusedError;

/** Groups the public types under a single import surface. */
export namespace Distill {
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
		/** What sanitizing the body took out, which is the shape of the page in five numbers. */
		sanitized: HTML.SanitizeReport;
	}

	/** An article, beside what retrieving it cost and what the response permits. */
	export interface Retrieved extends Article {
		/** Bytes read off the wire, which is the size the caps are spent against. */
		bytes: number;
		/**
		 * Whether the response permits this article being held for anybody else. A
		 * response whose `X-Robots-Tag` carries `noarchive` for every agent or for the one
		 * asking is read for whoever asked and kept for nobody.
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
		 * What `fetchRobots` from `@sdxc/robots/fetch` decided for the origin, fresh or from
		 * the caller's cache. Omitted, the origin's rules are not consulted.
		 */
		robots?: RobotsFetch.Outcome | undefined;
		maxBytes?: number | undefined;
		maxRedirects?: number | undefined;
		timeoutMs?: number | undefined;
		signal?: AbortSignal | undefined;
	}
}

/** The report a pass that never ran would have produced, so the field is always a number. */
const EMPTY_REPORT: HTML.SanitizeReport = {
	removedElements: 0,
	removedAttributes: 0,
	droppedUrls: 0,
	pixels: 0,
	durationMs: 0,
};

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
export function distillFrom(
	source: string,
	url: string,
): Result<Distill.Article, DistillEmptyError> {
	let document = parseDocument(source);
	if (isFailure(document)) {
		return failure(new DistillEmptyError(`Nothing to read at ${url}: it carried no markup`));
	}

	let body = articleOf(document.data);
	if (body === null) {
		return failure(new DistillEmptyError(`Nothing to read at ${url}: it carried no article`));
	}

	let canonical = canonicalOf(document.data, url);

	let sanitized: HTML.SanitizeReport | null = null;
	let cleaned = HTML.sanitize(serialize(body), {
		baseUrl: canonical,
		report: (value) => {
			sanitized = value;
		},
	});
	if (isFailure(cleaned)) {
		return failure(new DistillEmptyError(`Nothing to read at ${url}: the article was empty`));
	}

	let chars = (body.textContent ?? "").replaceAll(/\s+/gu, " ").trim().length;

	return success({
		html: cleaned.data,
		title: titleOf(document.data),
		byline: bylineOf(document.data),
		url: canonical,
		chars,
		sanitized: sanitized ?? EMPTY_REPORT,
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
 * @example let article = await distill(post.url, { userAgent: agent, robots });
 */
export async function distill(
	input: string,
	options: Distill.Options,
): Promise<Result<Distill.Retrieved, DistillError>> {
	let address = addressable(input);
	if (isFailure(address)) return address;

	if (
		options.robots !== undefined &&
		!isAllowedBy(options.robots, options.userAgent, address.data)
	) {
		return failure(new DistillRefusedError(`Refused ${input}: robots.txt disallows it`));
	}

	let retrieved = await retrieve(address.data, options);
	if (isFailure(retrieved)) return retrieved;

	if (essenceOf(retrieved.data.response) !== "text/html") {
		release(retrieved.data.response.body);
		return failure(new DistillEmptyError(`Nothing to read at ${input}: it is not a page`));
	}

	let read = await readText(retrieved.data.response, { maxBytes: options.maxBytes ?? MAX_BYTES });
	if (isFailure(read)) return failure(toDistillError(read.error));

	let article = distillFrom(read.data.text, retrieved.data.url);
	if (isFailure(article)) return article;

	return success({
		...article.data,
		bytes: read.data.bytes,
		mayCache: !directivesFor(retrieved.data.response, options.userAgent).noarchive,
	});
}
