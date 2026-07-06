/**
 * No-www middleware for the blog app. Detects request hostnames beginning with
 * "www." and issues a 302 redirect to the apex-domain equivalent, enforcing a
 * single canonical host for the site and avoiding split traffic across www and
 * non-www variants.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MiddlewareFunction } from "react-router";

import { redirect } from "react-router";

function createNoWWWMiddleware(): MiddlewareFunction<Response> {
	return async function noWWWMiddleware({ request }, next) {
		let url = new URL(request.url);

		if (url.hostname.startsWith("www.")) {
			url.hostname = url.hostname.slice(4);
			throw redirect(url.href, 302);
		}

		return await next();
	};
}

export const noWWWMiddleware = createNoWWWMiddleware();
