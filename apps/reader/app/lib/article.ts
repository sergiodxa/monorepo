/**
 * Reading a post's article: the shared cache is asked first, the page is retrieved only
 * on a miss, and whatever comes back — an article, a refusal, a timeout or nothing at
 * all — is one of five outcomes the reading page has copy for.
 *
 * Nothing here writes into a reader's object. An extraction lives in the shared cache
 * for as long as a link circulates and nowhere else, so no failure of this can touch a
 * timeline, a cursor or a saved post.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";
import { extract, fetchRobots } from "@sdxc/readability";
import { isFailure, isSuccess } from "@sdxc/result";

import { proxyImages } from "~/app/lib/media";
import {
	ARTICLE_TTL,
	articleCache,
	articleKey,
	FAILURE_TTL,
	MAX_STORED_BYTES,
	robotsKey,
	ROBOTS_TTL,
} from "~/database/article-cache";

/**
 * What this app calls itself when it asks a publisher for a page. It names the app and
 * links to it, so a publisher who wants to refuse this specifically can, without
 * refusing browsers.
 */
export const EXTRACTION_USER_AGENT = "SergioReader/1.0 (+https://reader.sergiodxa.com)";

/** What an attempt at a post's article amounted to, which is what the page renders. */
export type ArticleOutcome =
	/** The article is here. */
	| "extracted"
	/** The site said no: a status refusing the request, or a `robots.txt` disallowing it. */
	| "refused"
	/** Time, bytes or hops ran out. */
	| "timeout"
	/** The page arrived and carried no more than the reader already had. */
	| "empty";

/** An attempt, as it is written into the cache and as the page reads it back. */
export interface Article {
	outcome: ArticleOutcome;
	/** The sanitized body, or `null` for every outcome other than `extracted`. */
	html: string | null;
	title: string | null;
	byline: string | null;
	/** When the entry was written, which is what an age is measured from. */
	storedAt: number;
}

/** What reading one post's article needs, which is the post's link and what is stored of it. */
export interface ArticleRequest {
	/** The post's address, as the feed published it. */
	url: string;
	/**
	 * The summary already on the page. An extraction no longer than this has bought the
	 * reader nothing, which is one predicate covering teasers, consent interstitials and
	 * error pages together.
	 */
	summary: string | null;
}

/** An attempt that produced no article, which is what every failure is written as. */
function nothing(outcome: ArticleOutcome, storedAt: number): Article {
	return { outcome, html: null, title: null, byline: null, storedAt };
}

/** The host an event names, which is as much of an address as a log is ever told. */
function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

/**
 * The origin's `robots.txt`, from the shared cache or from the origin itself.
 *
 * A `Disallow` is the only machine-readable "no" the web has, and honouring it costs one
 * read a day per origin rather than one per open. An origin that serves none, or that
 * could not be asked, permits everything — which is what a missing document has always
 * meant.
 */
async function robotsFor(url: string): Promise<string | null> {
	let origin: string;
	try {
		origin = new URL(url).origin;
	} catch {
		return null;
	}

	let held = await articleCache().fetch<string | null>(
		robotsKey(origin),
		async () => await fetchRobots(origin, { userAgent: EXTRACTION_USER_AGENT }),
		{ ttl: ROBOTS_TTL },
	);

	return isSuccess(held) ? held.data : null;
}

/**
 * What the shared cache already holds for a post, or `null` when it holds nothing.
 *
 * One KV read, which is what lets a page that is about to render decide whether to print
 * the article inline or leave a frame to go and get it — waiting on a read beats
 * rendering a page that immediately replaces itself.
 *
 * @param url - The post's address.
 */
export async function peekArticle(url: string): Promise<Article | null> {
	let held = await articleCache().read<Article>(await articleKey(url));
	return isSuccess(held) ? held.data : null;
}

/**
 * The article for one post: a cache read, and on a miss one retrieval, one parse and one
 * write.
 *
 * Every outcome is a rendered state rather than an error, so a caller answers its reader
 * the same way whichever row of the table this lands on. An unreachable cache costs a
 * fetch and answers anyway; a response asking not to be archived is read for this reader
 * and written for nobody.
 *
 * @param post - The post's address, and the summary an extraction has to beat.
 * @example let article = await readArticle({ url: item.url, summary: item.summary });
 */
export async function readArticle(post: ArticleRequest): Promise<Article> {
	let cache = articleCache();
	let key = await articleKey(post.url);
	let host = hostOf(post.url);
	let log = currentLog();

	let held = await cache.read<Article>(key);
	if (isSuccess(held) && held.data !== null) {
		log?.note("article.cache", {
			host,
			outcome: held.data.outcome,
			age: Date.now() - held.data.storedAt,
		});
		return held.data;
	}

	log?.note("article.cache", { host, outcome: "miss", age: 0 });

	let robots = await robotsFor(post.url);

	let startedAt = Date.now();
	let spentFrom = performance.now();
	let extracted = await extract(post.url, { userAgent: EXTRACTION_USER_AGENT, robots });
	let cpuMs = Math.round(performance.now() - spentFrom);
	let durationMs = Date.now() - startedAt;

	let now = Date.now();

	if (isFailure(extracted)) {
		let article = nothing(extracted.error.outcome, now);

		log?.note("article.extraction", {
			host,
			outcome: article.outcome,
			bytes: 0,
			chars: 0,
			cpuMs,
			durationMs,
		});

		if (article.outcome === "refused") {
			log?.note("article.refused", { host, reason: extracted.error.name });
		}

		await cache.write(key, article, { ttl: FAILURE_TTL });
		return article;
	}

	let { byline, bytes, chars, html, mayCache, sanitized, title } = extracted.data;

	log?.note("html.sanitize", {
		removedElements: sanitized.removedElements,
		removedAttributes: sanitized.removedAttributes,
		droppedUrls: sanitized.droppedUrls,
		pixels: sanitized.pixels,
		durationMs: sanitized.durationMs,
	});

	/**
	 * Every image in the body is rewritten to this app's own address before anything holds
	 * or renders it, so a reader's browser asks one origin for the whole article and the
	 * policy it is served under can refuse every other one.
	 */
	let proxied = await proxyImages(html);

	/**
	 * An extraction no longer than what the reader already had is treated as nothing
	 * extractable, which is how a paywalled teaser is handled without anything trying to
	 * detect one.
	 */
	let isThin = chars <= (post.summary?.length ?? 0);
	let article: Article = isThin
		? nothing("empty", now)
		: { outcome: "extracted", html: proxied, title, byline, storedAt: now };

	log?.note("article.extraction", {
		host,
		outcome: article.outcome,
		bytes,
		chars,
		cpuMs,
		durationMs,
	});

	/**
	 * A response carrying `X-Robots-Tag: noarchive` is read for whoever asked and held
	 * for nobody, so that publisher's pages cost one fetch per open rather than one per
	 * article. A body past the cap is one the extractor got wrong, and is answered with
	 * rather than kept.
	 */
	if (mayCache && (article.html?.length ?? 0) <= MAX_STORED_BYTES) {
		await cache.write(key, article, { ttl: isThin ? FAILURE_TTL : ARTICLE_TTL });
	}

	return article;
}
