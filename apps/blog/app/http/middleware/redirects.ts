/**
 * Serves author-managed redirects, resolving the request path through
 * `RedirectsService`. A rule whose target resolves back to the current URL is
 * skipped so it cannot trap the request in a loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { inject } from "@sdxc/service-container";

import { RedirectsService } from "~/app/services/redirects";

const METHODS_TO_CHECK = new Set(["GET", "HEAD"]);

/**
 * Answers GET and HEAD requests with a redirect when a rule maps the path to a
 * different URL, carrying the rule's own status.
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
