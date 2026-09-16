/**
 * Cloudflare Worker entry point. Its `fetch` handler reads the session secret and KV
 * binding off the environment, builds the application router and forwards the request to
 * it; its `scheduled` handler runs the daily billing reconciliation; and it re-exports both
 * Durable Objects so the runtime can find the classes its bindings name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { reconcileBilling } from "~/app/lib/billing-sync";

import application from "./app";
import { logger } from "./logger";

export { FeedDO } from "~/database/feed-do";
export { UserDO } from "~/database/user-do";

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

	/**
	 * Re-reads what the platform says about every reader who has ever reached a checkout,
	 * which is what recovers a delivery nobody received. It is bounded by how many readers
	 * have paid rather than by how many readers there are.
	 */
	async scheduled(event, _environment, context) {
		context.waitUntil(
			logger.open("cron", { cron: { expression: event.cron } }).run(() => reconcileBilling()),
		);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
