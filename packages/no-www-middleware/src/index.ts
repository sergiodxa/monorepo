/**
 * Router middleware that keeps a site on its apex domain, answering any request to a `www.`
 * hostname with a `308` to the same URL without the prefix, so search engines index one host
 * and cookies scoped to it are always sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createRedirectResponse } from "remix/response/redirect";

/** The hostname label `noWWW()` strips. */
const WWW_PREFIX = "www.";

/**
 * Creates a middleware that redirects a request whose hostname starts with `www.` to the apex
 * domain with `308 Permanent Redirect`, so a `POST` is repeated with its method and body. Only
 * the leading `www.` label is removed; scheme, port, path and query carry over.
 *
 * @returns The middleware, answering before the handler whenever it redirects.
 * @example
 * createRouter({ middleware: [noWWW()] });
 */
export function noWWW(): Middleware {
	return function noWWWMiddleware(context, next) {
		let url = new URL(context.request.url);
		if (!url.hostname.startsWith(WWW_PREFIX)) return next();

		url.hostname = url.hostname.slice(WWW_PREFIX.length);
		return createRedirectResponse(url.href, 308);
	};
}
