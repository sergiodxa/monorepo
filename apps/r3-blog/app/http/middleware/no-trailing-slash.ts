import type { Middleware } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";

/**
 * Redirects any non-root path ending with `/` to its canonical no-trailing-slash URL.
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
