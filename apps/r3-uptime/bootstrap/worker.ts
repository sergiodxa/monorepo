/**
 * Cloudflare Worker entry point for the r3-uptime app. Its fetch handler resolves the
 * session cookie secret, opens a service-container scope, builds the application
 * router, and forwards the request to it. It exists as the runtime edge that connects
 * Cloudflare's environment to the app composition root, and re-exports the `Ping`
 * Workflow and `GeoFetchDO` Durable Object classes their bindings need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { GeoFetchDO } from "~/app/do/geo-fetch";
import { container } from "~/app/lib/container";
import { Ping } from "~/app/workflows/ping";

import application from "./app";

export { GeoFetchDO, Ping };

/** Whether the request arrived on a non-production host (local dev or workers.dev). */
function isSecureHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}

export default {
	/**
	 * Handles incoming Worker requests by resolving secrets, opening a container
	 * scope, and forwarding the request to the app router.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let cookieSecret = await env.COOKIE_SESSION_SECRET.get();
			let app = application({
				kv: env.KV,
				cookieSecret,
				secure: isSecureHost(request),
			});
			return await app.fetch(request);
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
