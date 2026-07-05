import { createAction } from "remix/fetch-router";

import { clearSessionCookie } from "~/app/lib/platform-session";
import routes from "~/routes/web";

/**
 * POST /logout — clears the platform session cookie and returns to onboarding.
 *
 * Sign-out is a POST (behind the CSRF/origin check) so it cannot be triggered by a
 * cross-site GET, and it actually clears the cookie instead of merely navigating
 * away (which previously left the 30-day session token live).
 */
export default createAction(routes.logout, async ({ logger }) => {
	logger.action("/logout").info("Platform sign-out");

	let headers = new Headers();
	headers.set("Location", routes.onboarding.index.href());
	headers.append("Set-Cookie", clearSessionCookie());
	return new Response(null, { status: 303, headers });
});
