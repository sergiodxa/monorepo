/**
 * `POST /logout` — signs the platform user out by clearing the session cookie and
 * redirecting back to the onboarding entry point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { PLATFORM_TENANT } from "~/app/lib/platform-bootstrap";
import {
	clearSessionCookie,
	getCookie,
	PLATFORM_SESSION_COOKIE,
	verifySessionToken,
} from "~/app/lib/platform-session";
import { TenantApiService } from "~/app/services/tenant-api";
import routes from "~/routes/web";

/**
 * Runs as a POST (behind the CSRF/origin check) so a cross-site GET can't
 * trigger sign-out, and revokes the server-side session so a copied token
 * can't be replayed; the cookie still clears if revocation fails.
 *
 * @returns A `303` redirect to the onboarding page with a cookie-clearing `Set-Cookie` header.
 * @example
 * router.map(routes.logout, logout);
 */
export default createAction(routes.logout, async ({ request, log }) => {
	let token = getCookie(request.headers.get("Cookie") ?? "", PLATFORM_SESSION_COOKIE);
	if (token) {
		let session = await verifySessionToken(token, env.SESSION_SECRET);
		if (session?.sessionId) {
			try {
				await new TenantApiService(PLATFORM_TENANT).deleteUserSession(
					session.subjectId,
					session.sessionId,
				);
				log.note("session.revoked");
			} catch (error) {
				log.warn("session.revoke_failed", {
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	let headers = new Headers();
	headers.set("Location", routes.onboarding.index.href());
	headers.append("Set-Cookie", clearSessionCookie());
	return new Response(null, { status: 303, headers });
});
