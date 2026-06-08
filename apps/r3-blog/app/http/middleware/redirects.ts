import type { Middleware } from "remix/fetch-router";

import { getEnv } from "~/app/http/middleware/env";
import { Redirect } from "~/app/repositories/redirect";

const METHODS_TO_CHECK = new Set(["GET", "HEAD"]);

/**
 * Resolves configured redirect rules for GET/HEAD requests and returns a redirect response when a valid target exists.
 */
let redirectsMiddleware: Middleware = async (ctx, next) => {
	if (!METHODS_TO_CHECK.has(ctx.method)) return next();

	let redirectRule = await Redirect.findByPath(getEnv("REDIRECTS"), ctx.url.pathname);
	if (!redirectRule) return next();

	let location = redirectRule.to;
	if (!location) return next();

	if (location.startsWith("/")) {
		let target = new URL(location, ctx.url);
		if (target.pathname === ctx.url.pathname && target.search === ctx.url.search) return next();
	}

	return new Response(null, {
		status: redirectRule.status,
		headers: { Location: location },
	});
};

export default redirectsMiddleware;
