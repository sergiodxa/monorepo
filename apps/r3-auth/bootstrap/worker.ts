/**
 * Cloudflare Worker entry point for the authorization server. Its `fetch` handler
 * opens a service-container scope, builds the application router, and forwards the
 * request to it, so everything a request touches resolves its dependencies from the
 * same scope. The `scheduled` and `queue` handlers arrive with the background job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { container } from "~/app/lib/container";

import application from "./app";

/**
 * Domain the session cookie is scoped to in production, so one sign-in at this server
 * is visible to every app under it. Left unset elsewhere: a `Domain` naming a host the
 * browser is not on makes the cookie be dropped silently.
 */
const PRODUCTION_COOKIE_DOMAIN = ".sergiodxa.com";

/**
 * Whether the request arrived on the production host, which is the only place the
 * session cookie may carry `Secure` and a domain.
 *
 * Decided per request rather than from a build flag, because the same build serves
 * `localhost` during development and a `workers.dev` host during the verification
 * window, and a `Secure` cookie on plain HTTP is a cookie the browser discards.
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
} satisfies ExportedHandler<Cloudflare.Env>;
