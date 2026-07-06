/**
 * `POST /logout` — signs the platform user out by clearing the session cookie and
 * redirecting back to the onboarding entry point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createAction } from "remix/fetch-router";

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
 * POST /logout — revokes the server-side platform session and clears the cookie.
 *
 * Sign-out is a POST (behind the CSRF/origin check) so it cannot be triggered by a
 * cross-site GET. Beyond clearing the browser cookie, it revokes the underlying platform
 * tenant session (the `sid` embedded in the signed token) so a copied token can no longer
 * be used — the session middleware rejects tokens whose `sid` no longer exists server-side.
 *
 * @returns A `303` redirect to the onboarding page with a cookie-clearing `Set-Cookie` header.
 * @example
 * router.map(routes.logout, logout);
 */
export default createAction(routes.logout, async ({ request, logger }) => {
	let log = logger.action("/logout");
	log.info("Platform sign-out");

	// Revoke the underlying platform tenant session so the token cannot be replayed.
	let token = getCookie(request.headers.get("Cookie") ?? "", PLATFORM_SESSION_COOKIE);
	if (token) {
		let session = await verifySessionToken(token, env.SESSION_SECRET);
		if (session?.sessionId) {
			try {
				await new TenantApiService(PLATFORM_TENANT).deleteUserSession(
					session.subjectId,
					session.sessionId,
				);
				log.info("Platform session revoked", { subjectId: session.subjectId });
			} catch (error) {
				// Best-effort: still clear the cookie even if revocation fails; the session
				// will lapse at expiry and the next privileged request re-checks the sid.
				log.error("Failed to revoke platform session", {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	let headers = new Headers();
	headers.set("Location", routes.onboarding.index.href());
	headers.append("Set-Cookie", clearSessionCookie());
	return new Response(null, { status: 303, headers });
});
