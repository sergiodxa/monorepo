/**
 * `POST /dashboard/sign-out` — clears the platform's own `__Host-session` cookie and
 * redirects to the marketing homepage. Nothing in this codebase serves a sign-out
 * mechanism yet: every route that opens a platform session (`/signup`, invitation
 * accept) has no counterpart that closes one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { sessionCookie } from "~/app/lib/session-cookie";
import routes from "~/routes/web";

/**
 * Expires the session cookie immediately by serializing it with `maxAge: 0`, then
 * redirects home.
 *
 * @param ctx - The request context.
 * @returns A redirect to `/` clearing the session cookie.
 * @example
 * router.map(routes.dashboard.signOut, dashboardSignOut);
 */
export const dashboardSignOut = createAction(routes.dashboard.signOut, async () => {
	let cleared = await sessionCookie.serialize("", { maxAge: 0 });

	return new Response(null, {
		status: 302,
		headers: { Location: routes.index.href(), "Set-Cookie": cleared },
	});
});
