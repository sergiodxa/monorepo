/**
 * Canonical-URL middleware: a non-root path ending in `/` gets a permanent
 * redirect to the slash-free form, so every page answers on a single address
 * for search engines and routing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@pkg/http/response";

/**
 * Permanently redirects a non-root path ending with `/` to its canonical
 * slash-free URL.
 */
export default function createNoTrailingSlashMiddleware(): Middleware {
	return async (ctx, next) => {
		let url = new URL(ctx.request.url);

		if (url.pathname.endsWith("/") && url.pathname !== "/") {
			url.pathname = url.pathname.slice(0, -1);
			return redirect(url.href, { status: redirect.Status.Permanent });
		}

		return next();
	};
}
