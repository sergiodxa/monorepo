/**
 * Cloudflare Worker entry point. Its single `fetch` handler reads the session secret and
 * KV binding off the environment, builds the application router, and forwards the request
 * to it. It is the only module allowed to touch a Cloudflare-specific API, so everything
 * below it runs in a plain fetch test without a worker runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import application from "./app";

/**
 * Whether the request arrived on a host that serves HTTPS, which decides the session
 * cookie's `Secure` flag. A local run and a `workers.dev` preview both answer over plain
 * HTTP, where a `Secure` cookie is dropped and every sign-in silently fails.
 */
function isSecureHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}

export default {
	/** Handles an incoming request by building the app router and forwarding to it. */
	async fetch(request: Request) {
		let app = application({
			kv: env.KV,
			cookieSecret: env.COOKIE_SESSION_SECRET,
			secure: isSecureHost(request),
		});

		return await app.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
