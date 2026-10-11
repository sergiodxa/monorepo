/**
 * Cloudflare Worker entry point for the books app. Its single `fetch` handler
 * builds the web router and forwards the request — the app's only state
 * lives in Buttondown and Polar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createWebRouter } from "~/app/initializers/router";

export default {
	/** Handles an incoming request by building the web router and forwarding it. */
	async fetch(request: Request) {
		let router = createWebRouter();
		return await router.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
