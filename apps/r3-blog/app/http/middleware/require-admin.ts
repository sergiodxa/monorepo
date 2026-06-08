import type { Middleware } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";

import { isAdmin } from "~/app/http/middleware/auth";
import routes from "~/routes/web";

/**
 * Allows admin users through and redirects non-admin users to the feed.
 */
let requireAdmin: Middleware = (_ctx, next) => {
	if (isAdmin()) return next();
	return redirect(routes.feed.href(), { status: redirect.Status.SeeOther });
};

export default requireAdmin;
