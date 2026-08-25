/**
 * Middleware that normalizes URLs by stripping trailing slashes, permanently
 * redirecting `/path/` to `/path` so each resource has a single canonical URL.
 * The root path `/` is left untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import middleware from "~/app/lib/middleware";

/**
 * Middleware to remove trailing slashes from URLs.
 * Redirects `/path/` to `/path` with a 301 (permanent redirect).
 * Excludes the root path `/` from redirection.
 *
 * @returns A `301` redirect to the slash-free URL, or the downstream response when no
 * trailing slash is present.
 * @example
 * router.use(trailingSlash);
 */
export default middleware(async (context, next) => {
	let url = new URL(context.request.url);

	if (url.pathname !== "/" && url.pathname.endsWith("/")) {
		url.pathname = url.pathname.slice(0, -1);
		return Response.redirect(url.toString(), 301);
	}

	return next();
});
