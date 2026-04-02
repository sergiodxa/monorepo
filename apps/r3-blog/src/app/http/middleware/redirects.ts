import middleware from "@pkg/remix-helpers/middleware";
import { env } from "cloudflare:workers";

import { Redirect } from "~/app/repositories/redirect";

const METHODS_TO_CHECK = new Set(["GET", "HEAD"]);

export default middleware(async (ctx, next) => {
	if (!METHODS_TO_CHECK.has(ctx.method)) return next();

	let redirectRule = await Redirect.findByPath(env.REDIRECTS, ctx.url.pathname);
	if (!redirectRule) return next();

	let location = redirectRule.to;
	if (!location) return next();

	if (location.startsWith("/")) {
		let target = new URL(location, ctx.url);
		if (target.pathname === ctx.url.pathname && target.search === ctx.url.search) return next();
	}

	return new Response(null, {
		status: redirectRule.status,
		headers: {
			Location: location,
		},
	});
});
