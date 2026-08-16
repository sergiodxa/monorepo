/**
 * Session middleware for the platform dashboard. Reads and verifies the signed,
 * self-contained platform session token from the cookie, attaches the authenticated
 * subject to `context.platformSession`, and redirects to onboarding when absent or
 * invalid. No database lookup is required because the token is cryptographically signed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { env } from "cloudflare:workers";

import middleware from "~/app/lib/middleware";
import { PLATFORM_TENANT } from "~/app/lib/platform-bootstrap";
import {
	clearSessionCookie,
	getCookie,
	isPlatformSessionActive,
	PLATFORM_SESSION_COOKIE,
	verifySessionToken,
} from "~/app/lib/platform-session";
import { TenantApiService } from "~/app/services/tenant-api";
import routes from "~/routes/web";

/**
 * Extends the request context with the authenticated platform session.
 */
declare module "remix/router" {
	interface RequestContext {
		platformSession: {
			/** The unique identifier for the authenticated subject */
			subjectId: string;
			/** The email address of the authenticated user */
			email: string;
			/** The tenant session ID (for identifying current session in platform tenant) */
			sessionId?: string;
		};
	}
}

/**
 * Session middleware for the platform dashboard.
 *
 * Validates the signed session token and attaches user info to context.
 * The session token is self-contained and cryptographically signed,
 * so no database lookup is needed for validation.
 *
 * Redirects to onboarding if no valid session exists.
 *
 * @returns The downstream response when authenticated, or a redirect to onboarding
 * (clearing the cookie when the token is invalid/expired).
 * @example
 * router.map(routes.dashboard.index, { middleware: session, handler });
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("session");

	let cookies = context.request.headers.get("Cookie") ?? "";
	let token = getCookie(cookies, PLATFORM_SESSION_COOKIE);

	if (!token) {
		log.info("No session cookie found, redirecting to onboarding");
		return redirect(routes.onboarding.index.href());
	}

	let session = await verifySessionToken(token, env.SESSION_SECRET);

	if (!session) {
		log.info("Invalid or expired session token, clearing session");
		return redirect(routes.onboarding.index.href(), {
			headers: {
				"Set-Cookie": clearSessionCookie(),
			},
		});
	}

	// The signed token is self-contained, but that alone cannot be revoked: a copied
	// token would stay valid for its full 30-day life even after logout. Validate the
	// embedded `sid` against the platform tenant's live session state so logout and
	// server-side revocation take effect. A token without a `sid` cannot be revoked, so
	// it is rejected (fail closed); all tokens minted by the callback carry one.
	let active = await isPlatformSessionActive(session.sessionId, (sid) =>
		new TenantApiService(PLATFORM_TENANT).sessionExists(session.subjectId, sid),
	);
	if (!active) {
		log.info("Platform session revoked or missing sid, clearing session");
		return redirect(routes.onboarding.index.href(), {
			headers: {
				"Set-Cookie": clearSessionCookie(),
			},
		});
	}

	context.platformSession = {
		subjectId: session.subjectId,
		email: session.email,
		sessionId: session.sessionId,
	};

	log.info("Session validated", { subjectId: session.subjectId });

	return next();
});
