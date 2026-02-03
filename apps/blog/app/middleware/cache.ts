import { createSingletonMiddleware } from "remix-utils/middleware/singleton";

import { Cache } from "~/modules/cache";

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
