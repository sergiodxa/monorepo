import middleware from "~/lib/middleware";

/**
 * Middleware to remove trailing slashes from URLs.
 * Redirects `/path/` to `/path` with a 301 (permanent redirect).
 * Excludes the root path `/` from redirection.
 */
export default middleware(async (context, next) => {
	let url = new URL(context.request.url);

	// Skip root path and paths without trailing slash
	if (url.pathname !== "/" && url.pathname.endsWith("/")) {
		url.pathname = url.pathname.slice(0, -1);
		return Response.redirect(url.toString(), 301);
	}

	return next();
});
