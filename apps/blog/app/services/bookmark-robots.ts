/**
 * The `robots.txt` the weekly bookmark check consults, fetched once per origin for as long
 * as the file's outcome stays fresh: the check reads several pages of a few sites at once,
 * and each site is asked for its rules once instead of once per page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RobotsFetch } from "@sdxc/robots/fetch";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isSuccess } from "@sdxc/result";
import { fetchRobots } from "@sdxc/robots/fetch";
import { env } from "cloudflare:workers";

import { BOOKMARK_USER_AGENT } from "~/app/services/bookmark-page";

/** The shortest lifetime KV accepts, which a shorter-lived outcome is rounded up to. */
const MIN_TTL_SECONDS = 60;

/**
 * The origin's `robots.txt` outcome for the bookmark checker. A cache that cannot be read
 * or written costs one fetch and answers anyway.
 *
 * @param url Any page of the origin.
 * @returns What the origin's rules say, as `@sdxc/robots` evaluates them.
 */
export async function robotsFor(url: URL): Promise<RobotsFetch.Outcome> {
	let cache = new WorkerKVCache(env.CACHE);
	let key = `bookmarks:robots:${url.origin}`;

	let held = await cache.read<RobotsFetch.Outcome>(key);
	if (isSuccess(held) && held.data !== null) return held.data;

	let outcome = await fetchRobots(url, { userAgent: BOOKMARK_USER_AGENT });
	let ttl = Math.max(MIN_TTL_SECONDS, Math.ceil(outcome.lifetimeMs / 1000));
	await cache.write(key, outcome, { ttl });

	return outcome;
}
