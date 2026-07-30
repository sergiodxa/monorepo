/**
 * HTTP middleware that guards admin-only routes. It lets requests continue when
 * the current user is an admin and otherwise redirects to the feed with a
 * 303 See Other. Exists to protect the CMS routes from non-admin access.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
