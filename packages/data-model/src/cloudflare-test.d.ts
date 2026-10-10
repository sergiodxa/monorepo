/**
 * Declares the bindings the Workers-pool tests run against, so `env` from `cloudflare:test`
 * is typed here the way a generated `worker-configuration.d.ts` types it in an app.
 *
 * The bindings are named inline in the `packages-workers` project in the root
 * `vite.config.ts`; this file is the type side of that declaration and stays in step with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare namespace Cloudflare {
	interface Env {
		/** The D1 database the degraded unit-of-work contract runs against. */
		DB: D1Database;
	}
}
