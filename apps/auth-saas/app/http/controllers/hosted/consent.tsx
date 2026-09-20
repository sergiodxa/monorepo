/**
 * `GET/POST /u/consent` — the scopes a client is asking for, approved or refused.
 * Both read the signed-in session from the `__Host-session` cookie, never from a
 * client-editable field: the interaction id names which pending request to
 * resume, but only a real, live session cookie can ever resume one as anybody.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import {
	redirectToErrorPage,
	respondToAuthorizationOutcome,
} from "~/app/http/controllers/hosted/outcome";
import { activeSessionId } from "~/app/http/middleware/hosted-session";
import routes from "~/routes/tenant";

/**
 * Resumes the named interaction with the request's own session, then renders the
 * consent screen inline when a decision is still owed, or follows wherever the
 * outcome sends the browser otherwise (a session that no longer resolves lands
 * back on `/u/sign-in`; nothing left to decide redirects onward with a code).
 *
 * @param ctx - The request context (provides `tenantStub`, `render` and `request`).
 * @returns The response this GET reaches on its own.
 * @example
 * router.map(routes.hostedConsentShow, consentShow);
 */
export const consentShow = createAction(routes.hostedConsentShow, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) {
		return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));
	}

	let sessionId = (await activeSessionId(ctx)) ?? "";

	let outcome = await ctx.tenantStub.resumeAuthorization({
		interactionId,
		sessionId,
		now: Date.now(),
	});

	return respondToAuthorizationOutcome(ctx, outcome, {
		renderConsentInline: true,
		consentAction: ctx.url.toString(),
		uiLocales: ctx.url.searchParams.get("ui_locales"),
	});
});

/**
 * Records the submitted decision and resumes the interaction again. A denial
 * skips recording anything — `recordConsentDecision` only ever writes a grant on
 * approval — and asks `resumeAuthorization` to answer with `access_denied`
 * directly. An approval records the exact scopes the freshly re-evaluated screen
 * named as requested, never a client-supplied list, before resuming once more.
 *
 * @param ctx - The request context (provides `tenantStub`, `formData`, `render` and `request`).
 * @returns The response this POST reaches on its own.
 * @example
 * router.map(routes.hostedConsentSubmit, consentSubmit);
 */
export const consentSubmit = createAction(routes.hostedConsentSubmit, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) {
		return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));
	}

	let sessionId = (await activeSessionId(ctx)) ?? "";
	let now = Date.now();
	let decision = ctx.formData.get("decision");

	if (decision === "deny") {
		let outcome = await ctx.tenantStub.resumeAuthorization({
			interactionId,
			sessionId,
			now,
			denied: true,
		});
		return respondToAuthorizationOutcome(ctx, outcome, {
			renderConsentInline: true,
			consentAction: ctx.url.toString(),
			uiLocales: ctx.url.searchParams.get("ui_locales"),
		});
	}

	let current = await ctx.tenantStub.resumeAuthorization({ interactionId, sessionId, now });

	if (current.kind === "consent") {
		await ctx.tenantStub.recordConsentDecision({
			subjectId: current.screen.subject.id,
			clientId: current.screen.client.id,
			approved: true,
			scopes: current.screen.requested.map((scope) => scope.scope),
		});

		current = await ctx.tenantStub.resumeAuthorization({ interactionId, sessionId, now });
	}

	return respondToAuthorizationOutcome(ctx, current, {
		renderConsentInline: true,
		consentAction: ctx.url.toString(),
		uiLocales: ctx.url.searchParams.get("ui_locales"),
	});
});
