/**
 * Cloudflare Worker entry point for the books app. Its single `fetch` handler
 * opens a service-container scope, builds the application router, and
 * forwards the request — the app's only state lives in Buttondown and Polar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { container } from "~/app/lib/container";

import application from "./app";

export default {
	/**
	 * Handles an incoming request by opening a container scope and forwarding it to the
	 * app router, so the request's services are constructed and cached per request.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let app = application();
			return await app.fetch(request);
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
