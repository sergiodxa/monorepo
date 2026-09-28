/**
 * Ambient declarations the build and the Worker runtime supply outside
 * `cloudflare.config.ts`: the Vite build stamp and the secrets the site runs
 * without, which a required config secret would make every deploy depend on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Identifier stamped on the build by Vite, which the cache validator is derived from. */
declare const __BUILD_ID__: string;

declare namespace Cloudflare {
	interface Env {
		/**
		 * Raises GitHub's rate limit for the changelog and sponsor reads; unauthenticated
		 * requests are used when it is unset.
		 */
		GITHUB_TOKEN?: string;
	}
}
