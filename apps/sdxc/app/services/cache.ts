/**
 * The one store this site keeps anything in. Every page renders from the deployed
 * bundle except the two that read GitHub — the changelog and the sponsors block — so
 * this namespace holds only what those two fetched, under keys each of them owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { env, waitUntil } from "cloudflare:workers";

/**
 * The store for one request. A write is handed to the invocation rather than awaited,
 * so the reader who paid for the fetch does not also pay for the put.
 */
export function siteCache(): Cache {
	return new WorkerKVCache(env.CACHE, { waitUntil });
}
