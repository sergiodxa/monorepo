/**
 * No-trailing-slash middleware for the blog app. Redirects any request whose
 * pathname ends in a slash (other than the root "/") to the equivalent slashless
 * URL, canonicalizing paths so a page is served from a single URL and avoiding
 * duplicate-content variants.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MiddlewareFunction } from "react-router";

import { redirect } from "react-router";

function createNoTrailingSlashMiddleware(): MiddlewareFunction<Response> {
	return async function noTrailingSlashMiddleware({ request }, next) {
		let url = new URL(request.url);

		if (url.pathname.endsWith("/") && url.pathname !== "/") {
			throw redirect(url.toString().slice(0, url.toString().length - 1));
		}

		return await next();
	};
}

export const noTrailingSlashMiddleware = createNoTrailingSlashMiddleware();
