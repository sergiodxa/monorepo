/**
 * Types the bindings the Workers-pool tests read from `cloudflare:test`. They are declared
 * inline in the root `packages-workers` project, and this file has to stay in step with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare namespace Cloudflare {
	interface Env {
		/** The D1 database the data-table store is exercised against. */
		DB: D1Database;
	}
}
