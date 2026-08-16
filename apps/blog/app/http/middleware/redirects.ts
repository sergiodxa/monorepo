/**
 * HTTP middleware that applies configured redirect rules. For GET/HEAD requests
 * it looks up a redirect for the current path via `RedirectsService` and, when a
 * valid non-self target exists, returns a redirect response with the rule's
 * status; otherwise it passes through. Exists to serve author-managed redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { inject } from "@pkg/service-container";

import { RedirectsService } from "~/app/services/redirects";

const METHODS_TO_CHECK = new Set(["GET", "HEAD"]);

/**
 * Resolves configured redirect rules for GET/HEAD requests and returns a redirect response when a valid target exists.
 */
let redirectsMiddleware: Middleware = (ctx, next) => {
	return inject([RedirectsService] as const, async (redirectsService) => {
		if (!METHODS_TO_CHECK.has(ctx.method)) return next();

		let redirectRule = await redirectsService.findByPath(ctx.url.pathname);
		if (!redirectRule) return next();

		let location = redirectRule.to;
		if (!location) return next();

		if (location.startsWith("/")) {
			let target = new URL(location, ctx.url);
			if (target.pathname === ctx.url.pathname && target.search === ctx.url.search) {
				return next();
			}
		}

		return new Response(null, {
			status: redirectRule.status,
			headers: { Location: location },
		});
	})();
};

export default redirectsMiddleware;
