/**
 * Keeps the CMS routes reserved for admins: everyone else lands back on the
 * feed through a 303 See Other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@pkg/http/response";

import { isAdmin } from "~/app/http/middleware/auth";
import routes from "~/routes/web";

/**
 * Lets an admin continue and sends every other request to the feed.
 */
let requireAdmin: Middleware = (_ctx, next) => {
	if (isAdmin()) return next();
	return redirect(routes.feed.href(), { status: redirect.Status.SeeOther });
};

export default requireAdmin;
