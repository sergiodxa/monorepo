/**
 * `GET/POST /u/second-factor` — the code a password or magic-link sign-in
 * demanded, or the fresh enrolment an administrator reset owes instead. `mode`
 * round-trips as a query parameter the way `sign-in.tsx`'s own flow state does,
 * set once by `sign-in.tsx` from `signInWithPassword`'s own answer, so this
 * screen never has to re-derive which state it is in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import {
	redirectToErrorPage,
	respondToAuthorizationOutcome,
} from "~/app/http/controllers/hosted/outcome";
import { activeSession } from "~/app/http/middleware/hosted-session";
import { requestOrigin } from "~/app/lib/request-origin";
import { serializeTrustedDeviceCookie } from "~/app/lib/trusted-device-cookie";
import { HostedDocument } from "~/app/views/hosted/document";
import { EnrolTotpFactorPage } from "~/app/views/hosted/enrol-totp-factor";
import { RecoveryCodesPage } from "~/app/views/hosted/recovery-codes";
import { SecondFactorPage } from "~/app/views/hosted/second-factor";
import routes from "~/routes/tenant";

/** Builds an absolute URL for one of this tenant's routes, carrying the interaction id. */
function actionUrl(ctx: { request: Request }, path: string, interactionId: string): string {
	let url = new URL(path, ctx.request.url);
	url.searchParams.set("interaction", interactionId);
	return url.toString();
}

/**
 * Renders the code-entry form for a subject who already holds a factor.
 *
 * @param ctx - The request context (provides `render`, `locale` and `i18next`).
 * @returns The rendered second-factor page.
 * @example
 * router.map(routes.hostedSecondFactorShow, secondFactorShow);
 */
export const secondFactorShow = createAction(routes.hostedSecondFactorShow, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) {
		return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));
	}

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));

	let mode = ctx.url.searchParams.get("mode");
	let t = ctx.i18next.t;

	if (mode === "enrol") {
		let enrolment = await ctx.tenantStub.beginTotpEnrolment({ subjectId: session.subjectId });
		if (!enrolment.ok) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

		return ctx.render(
			<HostedDocument title={t("hostedSecondFactor.enrol.title")} locale={ctx.locale}>
				<EnrolTotpFactorPage
					t={t}
					title={t("hostedSecondFactor.enrol.title")}
					body={t("hostedSecondFactor.enrol.body")}
					action={actionUrl(ctx, routes.hostedSecondFactorEnrolSubmit.href(), interactionId)}
					enrolmentId={enrolment.enrolmentId}
					uri={enrolment.uri}
					setupKey={enrolment.setupKey}
					codeLabel={t("hostedSecondFactor.enrol.codeLabel")}
					submitLabel={t("hostedSecondFactor.enrol.submit")}
					error={null}
				/>
			</HostedDocument>,
		);
	}

	return ctx.render(
		<HostedDocument title={t("hostedSecondFactor.title")} locale={ctx.locale}>
			<SecondFactorPage
				t={t}
				action={actionUrl(ctx, routes.hostedSecondFactorSubmit.href(), interactionId)}
				error={null}
			/>
		</HostedDocument>,
	);
});

/**
 * Completes the factor a sign-in demanded and resumes the interaction.
 *
 * @param ctx - The request context (provides `tenantStub`, `formData` and `request`).
 * @returns The response `resumeAuthorization` reaches once the factor is proven,
 * or this same page re-rendered with an error.
 * @example
 * router.map(routes.hostedSecondFactorSubmit, secondFactorSubmit);
 */
export const secondFactorSubmit = createAction(routes.hostedSecondFactorSubmit, async (ctx) => {
	let t = ctx.i18next.t;
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let submission = ctx.formData.get("submission");
	let trustDevice = ctx.formData.get("trustDevice") === "true";

	let action = actionUrl(ctx, routes.hostedSecondFactorSubmit.href(), interactionId);

	if (typeof submission !== "string" || !submission) {
		return ctx.render(
			<HostedDocument title={t("hostedSecondFactor.title")} locale={ctx.locale}>
				<SecondFactorPage t={t} action={action} error={t("hostedSecondFactor.errors.invalid")} />
			</HostedDocument>,
			{ status: 400 },
		);
	}

	let completed = await ctx.tenantStub.completeSecondFactor({
		sessionId: session.sessionId,
		submission,
		trustDevice,
		agent: requestOrigin(ctx.request),
	});

	if (!completed.ok) {
		let error =
			completed.reason === "replayed-submission"
				? t("hostedSecondFactor.errors.replayed")
				: t("hostedSecondFactor.errors.invalid");

		return ctx.render(
			<HostedDocument title={t("hostedSecondFactor.title")} locale={ctx.locale}>
				<SecondFactorPage t={t} action={action} error={error} />
			</HostedDocument>,
			{ status: 400 },
		);
	}

	let outcome = await ctx.tenantStub.resumeAuthorization({
		interactionId,
		sessionId: session.sessionId,
		now: Date.now(),
	});

	let response = await respondToAuthorizationOutcome(ctx, outcome, {
		uiLocales: ctx.url.searchParams.get("ui_locales"),
	});

	if (completed.trustedDeviceToken) {
		response.headers.append(
			"Set-Cookie",
			await serializeTrustedDeviceCookie(completed.trustedDeviceToken),
		);
	}

	return response;
});

/**
 * Activates the fresh factor an administrator reset owes, and shows its
 * recovery codes once. A wrong code has nothing left to retry against —
 * `activateTotpFactor` spends the enrolment row on any attempt — so this
 * redirects back to a fresh enrolment rather than re-rendering a dead one.
 *
 * @param ctx - The request context (provides `tenantStub`, `formData` and `request`).
 * @returns The recovery-codes reveal on success, or a redirect back to a fresh
 * enrolment.
 * @example
 * router.map(routes.hostedSecondFactorEnrolSubmit, secondFactorEnrolSubmit);
 */
export const secondFactorEnrolSubmit = createAction(
	routes.hostedSecondFactorEnrolSubmit,
	async (ctx) => {
		let t = ctx.i18next.t;
		let interactionId = ctx.url.searchParams.get("interaction");
		if (!interactionId) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

		let session = await activeSession(ctx);
		if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

		let enrolmentId = ctx.formData.get("enrolmentId");
		let code = ctx.formData.get("code");

		let retryUrl = new URL(routes.hostedSecondFactorShow.href(), ctx.request.url);
		retryUrl.searchParams.set("interaction", interactionId);
		retryUrl.searchParams.set("mode", "enrol");

		if (typeof enrolmentId !== "string" || !enrolmentId || typeof code !== "string" || !code) {
			return new Response(null, { status: 302, headers: { Location: retryUrl.toString() } });
		}

		let activated = await ctx.tenantStub.activateTotpFactor({ enrolmentId, code });
		if (!activated.ok) {
			return new Response(null, { status: 302, headers: { Location: retryUrl.toString() } });
		}

		await ctx.tenantStub.completeSecondFactorViaEnrolment({
			sessionId: session.sessionId,
			subjectId: activated.subjectId,
		});

		return ctx.render(
			<HostedDocument title={t("hostedSecondFactor.recoveryCodes.title")} locale={ctx.locale}>
				<RecoveryCodesPage
					t={t}
					title={t("hostedSecondFactor.recoveryCodes.title")}
					body={t("hostedSecondFactor.recoveryCodes.body")}
					codes={activated.recoveryCodes}
					continueAction={actionUrl(
						ctx,
						routes.hostedSecondFactorContinueSubmit.href(),
						interactionId,
					)}
					continueLabel={t("hostedSecondFactor.recoveryCodes.continueButton")}
				/>
			</HostedDocument>,
		);
	},
);

/**
 * Resumes the interaction once the recovery codes have been shown.
 *
 * @param ctx - The request context (provides `tenantStub` and `request`).
 * @returns The response `resumeAuthorization` reaches.
 * @example
 * router.map(routes.hostedSecondFactorContinueSubmit, secondFactorContinueSubmit);
 */
export const secondFactorContinueSubmit = createAction(
	routes.hostedSecondFactorContinueSubmit,
	async (ctx) => {
		let interactionId = ctx.url.searchParams.get("interaction");
		if (!interactionId) {
			return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));
		}

		let session = await activeSession(ctx);
		if (!session) return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));

		let outcome = await ctx.tenantStub.resumeAuthorization({
			interactionId,
			sessionId: session.sessionId,
			now: Date.now(),
		});

		return respondToAuthorizationOutcome(ctx, outcome, {
			uiLocales: ctx.url.searchParams.get("ui_locales"),
		});
	},
);
