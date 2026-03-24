import middleware from "@pkg/remix-helpers/middleware";
import { env } from "cloudflare:workers";

import { Redirect } from "~/models/redirect";

export const redirectsMiddleware = middleware(async (ctx, next) => {
	if (ctx.request.method !== "GET" && ctx.request.method !== "HEAD") return next();

	let url = new URL(ctx.request.url);
	let redirectRule = await Redirect.findByPath(env.REDIRECTS, url.pathname);
	if (!redirectRule) return next();

	let location = redirectRule.to;
	if (!location) return next();

	if (location.startsWith("/")) {
		let target = new URL(location, url);
		if (target.pathname === url.pathname && target.search === url.search) return next();
	}

	return new Response(null, {
		status: redirectRule.status,
		headers: {
			Location: location,
		},
	});
});
