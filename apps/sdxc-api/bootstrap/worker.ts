/**
 * Cloudflare Worker entry: builds the web router and forwards every fetch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createWebRouter } from "~/app/initializers/router";

export default {
	/** Handles an incoming request. */
	async fetch(request: Request) {
		let router = createWebRouter();
		return await router.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
