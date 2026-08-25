/**
 * Route guard requiring a signed-in viewer. On failure, stores the current URL in the
 * `returnTo` cookie before redirecting home so the visitor lands back where they
 * started after signing in. Implemented as a plain `Middleware` with no
 * context-transform generic, so it composes directly with route-specific
 * middleware chains. Must run after the `auth` middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@pkg/http/response";

import { returnTo } from "~/app/http/cookies";
import { isAuthenticated } from "~/app/http/middleware/auth";
import routes from "~/routes/web";

/**
 * Requires a signed-in viewer, redirecting anonymous requests home with a `returnTo`
 * cookie set to the originally requested URL.
 */
export let requireUser: Middleware = async (ctx, next) => {
	if (isAuthenticated()) return next();

	let headers = new Headers();
	headers.set("Set-Cookie", await returnTo.serialize(ctx.url.pathname + ctx.url.search));
	return redirect(routes.home.href(), { status: redirect.Status.SeeOther, headers });
};

export default requireUser;
