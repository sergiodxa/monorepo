/**
 * Types the bindings the Workers-pool tests read from `env` in `cloudflare:test`. Packages
 * declare their test bindings inline in the `packages-workers` project in the root
 * `vite.config.ts`, so this file hand-types them and must stay in step with that declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare namespace Cloudflare {
	interface Env {
		/** The R2 bucket the file storage is exercised against. */
		FILES: R2Bucket;
	}
}
