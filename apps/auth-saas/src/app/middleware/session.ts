import { redirect } from "@pkg/http/response";
import { env } from "cloudflare:workers";

import middleware from "~/lib/middleware";
import {
	clearSessionCookie,
	getCookie,
	PLATFORM_SESSION_COOKIE,
	verifySessionToken,
} from "~/lib/platform-session";

/**
 * Extends the request context with the authenticated platform session.
 */
declare module "remix/fetch-router" {
	interface RequestContext {
		platformSession: {
			/** The unique identifier for the authenticated subject */
			subjectId: string;
			/** The email address of the authenticated user */
			email: string;
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
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("session");

	let cookies = context.request.headers.get("Cookie") ?? "";
	let token = getCookie(cookies, PLATFORM_SESSION_COOKIE);

	if (!token) {
		log.info("No session cookie found, redirecting to onboarding");
		return redirect("/onboarding");
	}

	let session = await verifySessionToken(token, env.SESSION_SECRET);

	if (!session) {
		log.info("Invalid or expired session token, clearing session");
		return redirect("/onboarding", {
			headers: {
				"Set-Cookie": clearSessionCookie(),
			},
		});
	}

	context.platformSession = {
		subjectId: session.subjectId,
		email: session.email,
	};

	log.info("Session validated", { subjectId: session.subjectId });

	return next();
});
