import { redirect } from "@pkg/http/response";
import middleware from "@pkg/remix-helpers/middleware";

import { isAdmin } from "~/app/http/middleware/auth";
import routes from "~/routes/web";

/**
 * Allows admin users through and redirects non-admin users to the feed.
 */
export default middleware((_ctx, next) => {
	if (isAdmin()) return next();
	return redirect(routes.feed.href(), { status: redirect.Status.SeeOther });
});
