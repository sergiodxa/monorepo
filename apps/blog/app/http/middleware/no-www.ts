/**
 * Canonical-host middleware: a `www.` hostname gets a permanent redirect to the
 * apex domain, so the site answers on one host for search engines and for
 * cookies scoped to it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@pkg/http/response";

/**
 * Permanently redirects a `www.` hostname to the apex domain.
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
