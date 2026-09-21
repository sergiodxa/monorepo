/**
 * `GET/POST /u/step-up` — a relying party's `acr_values=mfa` demand, asking a
 * session that already signed in to prove its factor again, freshly, before
 * resuming. A subject with no factor at all is offered enrolment instead of a
 * code field, the same fallback `second-factor.tsx` renders for an
 * administrator reset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import {
	redirectToErrorPage,
	renderStepUpPage,
	respondToAuthorizationOutcome,
} from "~/app/http/controllers/hosted/outcome";
import { activeSession } from "~/app/http/middleware/hosted-session";
import { HostedDocument } from "~/app/views/hosted/document";
import { EnrolTotpFactorPage } from "~/app/views/hosted/enrol-totp-factor";
import { RecoveryCodesPage } from "~/app/views/hosted/recovery-codes";
import routes from "~/routes/tenant";

/** Builds an absolute URL for one of this tenant's routes, carrying the interaction id. */
function actionUrl(ctx: { request: Request }, path: string, interactionId: string): string {
	let url = new URL(path, ctx.request.url);
	url.searchParams.set("interaction", interactionId);
	return url.toString();
}

/**
 * Resumes the named interaction with the request's own session and renders
 * whatever it still owes: the step-up code field, an enrolment form for a
 * subject with no factor, or wherever else the outcome sends the browser.
 *
 * @param ctx - The request context (provides `tenantStub`, `render` and `request`).
 * @returns The response this GET reaches on its own.
 * @example
 * router.map(routes.hostedStepUpShow, stepUpShow);
 */
export const stepUpShow = createAction(routes.hostedStepUpShow, async (ctx) => {
	let t = ctx.i18next.t;
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let outcome = await ctx.tenantStub.resumeAuthorization({
		interactionId,
		sessionId: session.sessionId,
		now: Date.now(),
	});

	if (outcome.kind === "step-up" && !outcome.screen.hasFactor) {
		let enrolment = await ctx.tenantStub.beginTotpEnrolment({ subjectId: session.subjectId });
		if (!enrolment.ok) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

		return ctx.render(
			<HostedDocument title={t("hostedStepUp.enrol.title")} locale={ctx.locale}>
				<EnrolTotpFactorPage
					t={t}
					title={t("hostedStepUp.enrol.title")}
					body={t("hostedStepUp.enrol.body")}
					action={actionUrl(ctx, routes.hostedStepUpEnrolSubmit.href(), interactionId)}
					enrolmentId={enrolment.enrolmentId}
					uri={enrolment.uri}
					setupKey={enrolment.setupKey}
					codeLabel={t("hostedStepUp.enrol.codeLabel")}
					submitLabel={t("hostedStepUp.enrol.submit")}
					error={null}
				/>
			</HostedDocument>,
		);
	}

	return respondToAuthorizationOutcome(ctx, outcome, {
		renderStepUpInline: true,
		stepUpAction: actionUrl(ctx, routes.hostedStepUpSubmit.href(), interactionId),
		uiLocales: ctx.url.searchParams.get("ui_locales"),
	});
});

/**
 * Proves the step-up and resumes the interaction in one call.
 *
 * @param ctx - The request context (provides `tenantStub` and `formData`).
 * @returns The response the resumed interaction reaches once the step-up is
 * proven, or this same page re-rendered with an error.
 * @example
 * router.map(routes.hostedStepUpSubmit, stepUpSubmit);
 */
export const stepUpSubmit = createAction(routes.hostedStepUpSubmit, async (ctx) => {
	let t = ctx.i18next.t;
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let submission = ctx.formData.get("submission");
	let action = actionUrl(ctx, routes.hostedStepUpSubmit.href(), interactionId);

	if (typeof submission !== "string" || !submission) {
		return renderStepUpPage(ctx, action, t("hostedStepUp.errors.invalid"));
	}

	let result = await ctx.tenantStub.completeStepUp({
		interactionId,
		sessionId: session.sessionId,
		submission,
	});

	if (!result.ok) {
		let error =
			result.reason === "replayed-submission"
				? t("hostedStepUp.errors.replayed")
				: t("hostedStepUp.errors.invalid");
		return renderStepUpPage(ctx, action, error);
	}

	let { ok: _ok, ...outcome } = result;
	return respondToAuthorizationOutcome(ctx, outcome, {
		renderStepUpInline: true,
		stepUpAction: action,
		uiLocales: ctx.url.searchParams.get("ui_locales"),
	});
});

/**
 * Activates the factor a subject with none held, and shows its recovery codes
 * once. A wrong code has nothing left to retry against — `activateTotpFactor`
 * spends the enrolment row on any attempt — so this redirects back to a fresh
 * enrolment rather than re-rendering a dead one.
 *
 * @param ctx - The request context (provides `tenantStub` and `formData`).
 * @returns The recovery-codes reveal on success, or a redirect back to a fresh
 * enrolment.
 * @example
 * router.map(routes.hostedStepUpEnrolSubmit, stepUpEnrolSubmit);
 */
export const stepUpEnrolSubmit = createAction(routes.hostedStepUpEnrolSubmit, async (ctx) => {
	let t = ctx.i18next.t;
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let enrolmentId = ctx.formData.get("enrolmentId");
	let code = ctx.formData.get("code");

	let retryUrl = new URL(routes.hostedStepUpShow.href(), ctx.request.url);
	retryUrl.searchParams.set("interaction", interactionId);

	if (typeof enrolmentId !== "string" || !enrolmentId || typeof code !== "string" || !code) {
		return new Response(null, { status: 302, headers: { Location: retryUrl.toString() } });
	}

	let activated = await ctx.tenantStub.activateTotpFactor({ enrolmentId, code });
	if (!activated.ok) {
		return new Response(null, { status: 302, headers: { Location: retryUrl.toString() } });
	}

	return ctx.render(
		<HostedDocument title={t("hostedStepUp.recoveryCodes.title")} locale={ctx.locale}>
			<RecoveryCodesPage
				t={t}
				title={t("hostedStepUp.recoveryCodes.title")}
				body={t("hostedStepUp.recoveryCodes.body")}
				codes={activated.recoveryCodes}
				continueAction={actionUrl(ctx, routes.hostedStepUpContinueSubmit.href(), interactionId)}
				continueLabel={t("hostedStepUp.recoveryCodes.continueButton")}
			/>
		</HostedDocument>,
	);
});

/**
 * Moves the step-up through for a subject who just enrolled, and resumes the
 * interaction once the recovery codes have been shown.
 *
 * @param ctx - The request context (provides `tenantStub`).
 * @returns The response the resumed interaction reaches.
 * @example
 * router.map(routes.hostedStepUpContinueSubmit, stepUpContinueSubmit);
 */
export const stepUpContinueSubmit = createAction(routes.hostedStepUpContinueSubmit, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) {
		return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));
	}

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));

	let result = await ctx.tenantStub.completeStepUpViaEnrolment({
		interactionId,
		sessionId: session.sessionId,
	});

	if (!result.ok) return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));

	let { ok: _ok, ...outcome } = result;
	return respondToAuthorizationOutcome(ctx, outcome, {
		uiLocales: ctx.url.searchParams.get("ui_locales"),
	});
});
