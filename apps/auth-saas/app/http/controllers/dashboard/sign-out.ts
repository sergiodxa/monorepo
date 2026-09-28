/**
 * `POST /dashboard/sign-out` — revokes the session at the platform tenant itself,
 * then clears the platform's own `__Host-session` cookie and redirects to the
 * marketing homepage. Clearing the cookie alone would leave the token it carried
 * live until its own natural expiry, reachable by anyone who had already copied it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { resolveDashboardSession } from "~/app/http/middleware/dashboard-session";
import { sessionCookie } from "~/app/lib/session-cookie";
import routes from "~/routes/web";

/**
 * Revokes the request's own dashboard session at the platform tenant, when it
 * carries one that still resolves, then expires the session cookie and redirects
 * home.
 *
 * @param ctx - The request context.
 * @returns A redirect to `/` clearing the session cookie.
 * @example
 * router.map(routes.dashboard.signOut, dashboardSignOut);
 */
export const dashboardSignOut = createAction(routes.dashboard.signOut, async (ctx) => {
	let session = await resolveDashboardSession(ctx);
	if (session) {
		let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);
		await platform.revokeSession({
			subjectId: session.subjectId,
			sessionId: session.sessionId,
			reason: "signed_out",
			actor: { type: "subject", id: session.subjectId },
		});
	}

	let cleared = await sessionCookie.serialize("", { maxAge: 0 });

	return new Response(null, {
		status: 302,
		headers: { Location: routes.index.href(), "Set-Cookie": cleared },
	});
});
