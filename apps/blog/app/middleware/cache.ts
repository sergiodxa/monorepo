/**
 * Cache middleware and accessor for the blog app. Uses a singleton middleware to
 * lazily build a KV-backed Cache instance (wired to the cache KV namespace and
 * the Worker's waitUntil) once per request, and exposes getCache() so models and
 * loaders share a single cache client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Cache } from "@pkg/cache";
import { createSingletonMiddleware } from "remix-utils/middleware/singleton";

import { getBindings } from "./bindings";
import { getContext } from "./context-storage";

const [cacheMiddleware, getCacheFromContext] = createSingletonMiddleware({
	instantiator: () => {
		return new Cache.KVStore(getBindings().kv.cache, getBindings().waitUntil);
	},
});

export function getCache() {
	let context = getContext();
	return getCacheFromContext(context);
}

export { cacheMiddleware };
