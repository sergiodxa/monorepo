/**
 * The shared store of extracted articles: one entry per article URL, holding the body
 * the extractor produced, beside one entry per origin holding that origin's
 * `robots.txt`.
 *
 * Nothing in here is about who asked. Two readers who open the same link want the same
 * bytes, so the key carries the article and nothing else and the second of them pays a
 * read rather than a fetch, a parse and a write. Every byte is reconstructible by
 * fetching the page again, which is what lets this expire on its own and lets losing
 * the namespace cost nothing owned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { DurationString } from "@sdxc/duration";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

/**
 * Namespace for the articles inside the KV this app shares between the sessions, the
 * provider's discovery document and the feed heads, each kept apart by its own prefix.
 */
const ARTICLE_KEY_PREFIX = "article";

/** And for the `robots.txt` each origin is asked for once a day rather than per open. */
const ROBOTS_KEY_PREFIX = "robots";

/**
 * How long an extracted article is held. A link circulates for about a week, which is
 * the window in which sharing an extraction between readers is worth anything, and it
 * is short enough that this stays a cache rather than a copy.
 */
export const ARTICLE_TTL: DurationString = "7 days";

/**
 * How long an attempt that produced nothing is remembered. Long enough that a blocked
 * article stops hitting the origin on every re-open, short enough that a site which was
 * down is tried again today rather than next week.
 */
export const FAILURE_TTL: DurationString = "1 hour";

/** How long an origin's `robots.txt` is held, which is how often it is re-read. */
export const ROBOTS_TTL: DurationString = "24 hours";

/**
 * How much sanitized markup is written. A cost decision rather than a store limit: KV
 * holds far more than this, and an extraction past half a megabyte is one the extractor
 * got wrong.
 */
export const MAX_STORED_BYTES = 512 * 1024;

/**
 * Where one article is held.
 *
 * A digest rather than the URL, for the reason a feed's head is keyed by its id: a KV
 * key stops at 512 bytes and a URL does not. It carries no reader identifier by
 * construction rather than by convention, which is what lets one entry serve everyone.
 *
 * @param url - The article's canonical address.
 */
export async function articleKey(url: string): Promise<string> {
	let digest = await sha256(url);
	if (isFailure(digest)) throw digest.error;
	return `${ARTICLE_KEY_PREFIX}:${Hex.encode(digest.data)}`;
}

/**
 * Where one origin's `robots.txt` is held. The origin is short and fixed-width enough
 * to be the key itself, so a cached document is legible in the namespace.
 *
 * @param origin - The scheme and host the document governs.
 */
export function robotsKey(origin: string): string {
	return `${ROBOTS_KEY_PREFIX}:${origin}`;
}

/**
 * The store extractions are read from and written to.
 *
 * A write is finished before the answer is given, so the next reader to open the same
 * link finds it there. The only request that writes here is the one fetching an article
 * the page it belongs to has already been sent, so the milliseconds are spent behind the
 * reader rather than in front of them.
 */
export function articleCache(): Cache {
	return new WorkerKVCache(env.KV);
}
