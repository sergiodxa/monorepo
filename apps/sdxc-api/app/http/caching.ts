/**
 * Edge cache for the landing's generated Open Graph card. The colo's Workers
 * Cache keeps the PNG after the first draw; a later request for the same
 * revision is served from that copy. The Cache API is per colo and evicts on
 * its own, so a miss draws the card again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { policy } from "@sdxc/http/cache";
import { waitUntil } from "cloudflare:workers";

import { OG_IMAGE_REVISION } from "~/config/site";

/**
 * How long a browser and a shared cache may reuse one revision. The URL's `v`
 * changes when the drawing does, which is what retires a stored copy.
 */
export const OG_CACHE_CONTROL = policy({
	visibility: "public",
	maxAge: "1 day",
	sMaxAge: "30 days",
}).toString();

/**
 * Serves a stored card for `request` when this colo has one, and stores a
 * public 200 the caller just drew. Outside the Workers runtime every call draws.
 *
 * @param request - The incoming request. Only its `v` query joins the cache key.
 * @param render - Draws the card. Runs on a miss.
 * @returns The stored response, or the one `render` produced.
 */
export async function serveOgImage(
	request: Request,
	render: () => Promise<Response>,
): Promise<Response> {
	let cache = edgeCache();
	let key = cacheKey(request);
	if (cache) {
		let hit = await cache.match(key);
		if (hit) return hit;
	}

	let response = await render();
	let control = response.headers.get("cache-control") ?? "";
	let storable = cache !== null && response.status === 200 && control.includes("public");
	if (storable && cache) waitUntil(cache.put(key, response.clone()));
	return response;
}

/**
 * The request the colo stores under. Tracking parameters are dropped so they
 * do not each draw a copy, and a missing `v` means the current revision.
 */
function cacheKey(request: Request): Request {
	let url = new URL(request.url);
	let revision = url.searchParams.get("v") ?? OG_IMAGE_REVISION;
	url.search = "";
	url.searchParams.set("v", revision);
	return new Request(url, { method: "GET" });
}

/**
 * The colo's Workers cache, absent outside the Workers runtime. Cast, since the
 * DOM's `CacheStorage` type shadows the Workers declaration that has `default`.
 */
function edgeCache(): Cache | null {
	if (typeof caches === "undefined") return null;
	return (caches as unknown as { default?: Cache }).default ?? null;
}
