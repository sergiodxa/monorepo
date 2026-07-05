import { redirect } from "@pkg/http/response";

import middleware from "../lib/middleware";

/** Redirects `/path/` to `/path` (root excluded) so URLs stay canonical. */
export default middleware((context, next) => {
	let url = new URL(context.request.url);
	if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
		url.pathname = url.pathname.replace(/\/+$/, "");
		return redirect(url.pathname + url.search, { status: redirect.Status.Permanent });
	}
	return next();
});
