/**
 * Route guard requiring a signed-in reader. It stores the requested URL in the `returnTo`
 * cookie before redirecting home, so signing in lands the visitor back where they started.
 * A plain `Middleware` with no context-transform generic, so it composes directly into a
 * route's own middleware chain. Runs after the `auth` middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@sdxc/http/response";

import { RETURN_TO_COOKIE } from "~/app/http/cookies";
import { isAuthenticated } from "~/app/http/middleware/auth";
import routes from "~/routes/web";

/**
 * Requires a signed-in reader, redirecting an anonymous request home with a `returnTo`
 * cookie set to the originally requested URL.
 */
export let requireUser: Middleware = async (ctx, next) => {
	if (isAuthenticated()) return next();

	let headers = new Headers();
	headers.set("Set-Cookie", await RETURN_TO_COOKIE.serialize(ctx.url.pathname + ctx.url.search));

	return redirect(routes.home.href(), { status: redirect.Status.SeeOther, headers });
};

export default requireUser;
