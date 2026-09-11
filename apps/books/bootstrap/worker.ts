/**
 * Cloudflare Worker entry point for the books app. Its single `fetch` handler
 * builds the application router and forwards the request — the app's only state
 * lives in Buttondown and Polar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import application from "./app";

export default {
	/** Handles an incoming request by building the app router and forwarding it. */
	async fetch(request: Request) {
		let app = application();
		return await app.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
