/**
 * Middleware that canonicalizes URLs by permanently redirecting `/path/` to `/path`
 * (the root `/` excepted), so a page never has two addressable forms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { redirect } from "@sdxc/http/response";

import middleware from "../lib/middleware.js";

/** Redirects `/path/` to `/path` (root excluded) so URLs stay canonical. */
export default middleware((context, next) => {
	let url = new URL(context.request.url);
	if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
		url.pathname = url.pathname.replace(/\/+$/, "");
		return redirect(url.pathname + url.search, { status: redirect.Status.Permanent });
	}
	return next();
});
