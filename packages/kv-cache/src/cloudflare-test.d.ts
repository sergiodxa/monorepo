/**
 * Declares the bindings the Workers-pool tests run against, so `env` from `cloudflare:test`
 * is typed here the way a generated `worker-configuration.d.ts` types it in an app.
 *
 * A package has no Worker and no wrangler config, so its test bindings are named inline in the
 * `packages-workers` project in the root `vite.config.ts`. This file is the type side of that
 * declaration and has to stay in step with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare namespace Cloudflare {
	interface Env {
		/** The KV namespace `Cache.KVStore` is exercised against. */
		CACHE: KVNamespace;
	}
}
