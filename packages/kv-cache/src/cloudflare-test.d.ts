/**
 * Types the bindings the Workers-pool tests read from `env` in `cloudflare:test`, the way a
 * generated `worker-configuration.d.ts` types them in an app. Packages declare their test
 * bindings inline in the `packages-workers` project in the root `vite.config.ts`, so this file
 * hand-types them from that declaration and must stay in step with it.
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
