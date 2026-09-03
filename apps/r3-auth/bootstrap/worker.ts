/**
 * Cloudflare Worker entry point for the authorization server. Its `fetch` handler
 * opens a service-container scope, builds the application router, and forwards the
 * request to it, so everything a request touches resolves its dependencies from the
 * same scope. `scheduled` and `queue` delegate to the job dispatcher, which opens a
 * scope of its own around every job it runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { dispatcher } from "~/app/jobs/dispatcher";
import { container } from "~/app/lib/container";

import application from "./app";

/**
 * Domain the session cookie is scoped to in production, so one sign-in at this server
 * is visible to every app under it. A `Domain` naming a different host makes the cookie
 * be dropped silently, so it stays unset outside production.
 */
const PRODUCTION_COOKIE_DOMAIN = ".sergiodxa.com";

/**
 * Whether the request arrived on the production host, the only place the
 * session cookie may carry `Secure` and a domain. Decided per request since
 * the same build also serves `localhost` and a `workers.dev` verification host.
 */
function isProductionHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	return hostname === "auth.sergiodxa.com";
}

export default {
	/**
	 * Serves an HTTP request inside a container scope.
	 * @param request - The inbound request.
	 * @returns The router's response.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let production = isProductionHost(request);

			let app = application({
				kv: env.KV,
				cookieSecret: env.COOKIE_SESSION_SECRET,
				secure: production,
				cookieDomain: production ? PRODUCTION_COOKIE_DOMAIN : undefined,
			});

			return await app.fetch(request);
		});
	},

	/**
	 * Enqueues the work a cron delivery implies, so a sweep that outgrows the
	 * trigger's budget becomes the queue's problem and gets its own retries.
	 * @param controller - The trigger being delivered.
	 */
	async scheduled(controller) {
		await dispatcher.scheduled(controller);
	},

	/**
	 * Runs the job each queued message names, settling once every one of them has.
	 * @param batch - The messages this delivery carries.
	 */
	async queue(batch) {
		await dispatcher.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
