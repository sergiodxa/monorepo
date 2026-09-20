/**
 * `GET /authorize` — the endpoint ADR-011 deliberately left unbuilt: resolves the
 * request's session cookie, if any, to a candidate session id, hands the whole
 * request to `beginAuthorization`, and turns its outcome into a response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { respondToAuthorizationOutcome } from "~/app/http/controllers/hosted/outcome";
import { activeSessionId } from "~/app/http/middleware/hosted-session";
import routes from "~/routes/tenant";

/**
 * Resolves the request's session, if any, begins the authorization request
 * against it, and answers with whatever `beginAuthorization` decides.
 *
 * @param ctx - The request context (provides `tenantStub` and `render`).
 * @returns The response this request reaches on its own: a redirect, a rendered
 * error, or a redirect onward to a hosted sign-in or consent screen.
 * @example
 * router.map(routes.authorize, authorize);
 */
export default createAction(routes.authorize, async (ctx) => {
	let sessionId = await activeSessionId(ctx);
	let uiLocales = ctx.url.searchParams.get("ui_locales");

	let outcome = await ctx.tenantStub.beginAuthorization({
		query: Object.fromEntries(ctx.url.searchParams),
		sessionIds: sessionId ? [sessionId] : [],
		now: Date.now(),
	});

	return respondToAuthorizationOutcome(ctx, outcome, { uiLocales, renderErrorInline: true });
});
