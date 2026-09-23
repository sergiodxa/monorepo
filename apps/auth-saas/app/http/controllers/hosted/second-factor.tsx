/**
 * `GET/POST /u/second-factor` — the code a password or magic-link sign-in
 * demanded, or the fresh enrolment an administrator reset owes instead. `mode`
 * round-trips as a query parameter the way `sign-in.tsx`'s own flow state does,
 * set once by `sign-in.tsx` from `signInWithPassword`'s own answer, so this
 * screen never has to re-derive which state it is in.
 *
 * Carries `interaction` or `return_to` through unchanged, whichever
 * `sign-in.tsx` handed it, and resumes the same way at the end of every leg.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import {
	redirectToErrorPage,
	redirectToReturnTo,
	respondToAuthorizationOutcome,
	safeReturnTo,
} from "~/app/http/controllers/hosted/outcome";
import { activeSession } from "~/app/http/middleware/hosted-session";
import { recordAttackSignal } from "~/app/lib/attack-signals";
import { requestOrigin } from "~/app/lib/request-origin";
import { serializeTrustedDeviceCookie } from "~/app/lib/trusted-device-cookie";
import { HostedDocument } from "~/app/views/hosted/document";
import { EnrolTotpFactorPage } from "~/app/views/hosted/enrol-totp-factor";
import { RecoveryCodesPage } from "~/app/views/hosted/recovery-codes";
import { SecondFactorPage } from "~/app/views/hosted/second-factor";
import routes from "~/routes/tenant";

/** What this screen resumes with at the end of every leg: an interaction id, or a `return_to` path when there is none. */
interface Resume {
	interactionId: string | null;
	returnTo: string | null;
}

/** Reads whichever of `interaction`/`return_to` the request carries. */
function readResume(ctx: RequestContext): Resume {
	return { interactionId: ctx.url.searchParams.get("interaction"), returnTo: safeReturnTo(ctx) };
}

/** Builds an absolute URL for one of this tenant's routes, carrying whichever of `interaction`/`return_to` this leg resumes with. */
function actionUrl(ctx: { request: Request }, path: string, resume: Resume): string {
	let url = new URL(path, ctx.request.url);
	if (resume.interactionId) url.searchParams.set("interaction", resume.interactionId);
	if (resume.returnTo) url.searchParams.set("return_to", resume.returnTo);
	return url.toString();
}

/**
 * Resumes with `interaction` when this leg was given one, or redirects
 * straight to `return_to` otherwise — the same branch `sign-in.tsx` takes once
 * a session is open.
 */
async function resume(
	ctx: RequestContext,
	value: Resume,
	sessionId: string,
	uiLocales: string | null,
): Promise<Response> {
	if (value.interactionId) {
		let outcome = await ctx.tenantStub.resumeAuthorization({
			interactionId: value.interactionId,
			sessionId,
			now: Date.now(),
		});
		return respondToAuthorizationOutcome(ctx, outcome, { uiLocales });
	}

	// `readResume` never returns both fields empty on a route this module's own
	// top guard already let through.
	return redirectToReturnTo(ctx, value.returnTo as string);
}

/**
 * Renders the code-entry form for a subject who already holds a factor.
 *
 * @param ctx - The request context (provides `render`, `locale` and `intl`).
 * @returns The rendered second-factor page.
 * @example
 * router.map(routes.hostedSecondFactorShow, secondFactorShow);
 */
export const secondFactorShow = createAction(routes.hostedSecondFactorShow, async (ctx) => {
	let value = readResume(ctx);
	if (!value.interactionId && !value.returnTo) {
		return redirectToErrorPage(ctx, ctx.intl.t("hostedError.invalidInteraction"));
	}

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, ctx.intl.t("hostedError.invalidInteraction"));

	let mode = ctx.url.searchParams.get("mode");
	let t = ctx.intl.t;

	if (mode === "enrol") {
		let enrolment = await ctx.tenantStub.beginTotpEnrolment({ subjectId: session.subjectId });
		if (!enrolment.ok) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

		return ctx.render(
			<HostedDocument title={t("hostedSecondFactor.enrol.title")} locale={ctx.locale}>
				<EnrolTotpFactorPage
					t={t}
					title={t("hostedSecondFactor.enrol.title")}
					body={t("hostedSecondFactor.enrol.body")}
					action={actionUrl(ctx, routes.hostedSecondFactorEnrolSubmit.href(), value)}
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
				action={actionUrl(ctx, routes.hostedSecondFactorSubmit.href(), value)}
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
	let t = ctx.intl.t;
	let value = readResume(ctx);
	if (!value.interactionId && !value.returnTo) {
		return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));
	}

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let submission = ctx.formData.get("submission");
	let trustDevice = ctx.formData.get("trustDevice") === "true";

	let action = actionUrl(ctx, routes.hostedSecondFactorSubmit.href(), value);

	if (typeof submission !== "string" || !submission) {
		return ctx.render(
			<HostedDocument title={t("hostedSecondFactor.title")} locale={ctx.locale}>
				<SecondFactorPage t={t} action={action} error={t("hostedSecondFactor.errors.invalid")} />
			</HostedDocument>,
			{ status: 400 },
		);
	}

	let origin = requestOrigin(ctx.request);

	let completed = await ctx.tenantStub.completeSecondFactor({
		sessionId: session.sessionId,
		submission,
		trustDevice,
		agent: origin,
	});

	if (!completed.ok) {
		if (completed.reason === "invalid-submission") {
			recordAttackSignal(env, {
				tenantId: ctx.tenant.id,
				surface: "credential",
				outcome: completed.retryAfter !== undefined ? "refused-backoff" : "refused-credential",
				reason: "invalid-submission",
				country: origin.country ?? undefined,
			});
		}

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

	recordAttackSignal(env, {
		tenantId: ctx.tenant.id,
		surface: "credential",
		outcome: "succeeded",
		country: origin.country ?? undefined,
	});

	let response = await resume(
		ctx,
		value,
		session.sessionId,
		ctx.url.searchParams.get("ui_locales"),
	);

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
		let t = ctx.intl.t;
		let value = readResume(ctx);
		if (!value.interactionId && !value.returnTo) {
			return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));
		}

		let session = await activeSession(ctx);
		if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

		let enrolmentId = ctx.formData.get("enrolmentId");
		let code = ctx.formData.get("code");

		let retryUrl = new URL(actionUrl(ctx, routes.hostedSecondFactorShow.href(), value));
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
					continueAction={actionUrl(ctx, routes.hostedSecondFactorContinueSubmit.href(), value)}
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
		let value = readResume(ctx);
		if (!value.interactionId && !value.returnTo) {
			return redirectToErrorPage(ctx, ctx.intl.t("hostedError.invalidInteraction"));
		}

		let session = await activeSession(ctx);
		if (!session) return redirectToErrorPage(ctx, ctx.intl.t("hostedError.invalidInteraction"));

		return resume(ctx, value, session.sessionId, ctx.url.searchParams.get("ui_locales"));
	},
);
