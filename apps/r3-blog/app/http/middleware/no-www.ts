import type { Middleware } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";

/**
 * Redirects `www.` hostnames to the apex domain with a permanent redirect.
 * Passes through unchanged requests when the hostname is already non-`www`.
 */
export default function createNoWWWMiddleware(): Middleware {
	return async (ctx, next) => {
		let url = new URL(ctx.request.url);

		if (url.hostname.startsWith("www.")) {
			url.hostname = url.hostname.slice(4);
			return redirect(url.href, { status: redirect.Status.Permanent });
		}

		return next();
	};
}
