/**
 * `GET/POST /u/sign-in` — identifier and password, and a passkey button (see
 * `sign-in-passkey.tsx` for the ceremony's own two endpoints). The interaction id,
 * `login_hint`, `forced` and `ui_locales` all round-trip as query parameters on
 * this page's own URL, carried onto its form and passkey actions unchanged, so
 * the flow state itself never leaves the interaction row a person can edit.
 *
 * A caller with no interaction of its own to resume — `/device`'s own approval
 * screen, which parks nothing server-side beyond the row its code already
 * names — carries a `return_to` path instead, and is sent back there directly
 * once signed in rather than through `resumeAuthorization`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import {
	redirectToErrorPage,
	redirectToReturnTo,
	respondToAuthorizationOutcome,
	safeReturnTo,
} from "~/app/http/controllers/hosted/outcome";
import { passesConditionalTurnstileChallenge } from "~/app/http/controllers/hosted/turnstile-guard";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import { CREDENTIAL_FAILURE_SPEND } from "~/app/http/middleware/tenant-rate-limit";
import { recordAttackSignal } from "~/app/lib/attack-signals";
import { requestOrigin } from "~/app/lib/request-origin";
import { readTrustedDeviceToken } from "~/app/lib/trusted-device-cookie";
import { HostedDocument } from "~/app/views/hosted/document";
import { SignInPage } from "~/app/views/hosted/sign-in";
import routes from "~/routes/tenant";

/** Builds an absolute URL for one of this tenant's routes, carrying the current request's query along. */
function actionUrl(ctx: RequestContext, path: string): string {
	let url = new URL(path, ctx.request.url);
	for (let [key, value] of ctx.url.searchParams) url.searchParams.set(key, value);
	return url.toString();
}

/** Renders the sign-in form, carrying the current request's own query onto every action. */
async function renderSignInPage(
	ctx: RequestContext,
	input: {
		loginHint: string | null;
		forced: boolean;
		error: string | null;
		challenge: boolean;
	},
): Promise<Response> {
	let t = ctx.intl.t;

	return ctx.render(
		<HostedDocument title={t("hostedSignIn.title")} locale={ctx.locale}>
			<SignInPage
				t={t}
				action={actionUrl(ctx, routes.hostedSignInSubmit.href())}
				passkeyOptionsAction={actionUrl(ctx, routes.hostedSignInPasskeyOptions.href())}
				passkeyVerifyAction={actionUrl(ctx, routes.hostedSignInPasskeyVerify.href())}
				loginHint={input.loginHint}
				forced={input.forced}
				error={input.error}
				challenge={input.challenge}
				turnstileSiteKey={env.TURNSTILE_SITE_KEY}
			/>
		</HostedDocument>,
		input.error ? { status: 400 } : undefined,
	);
}

/**
 * Renders the sign-in form for the interaction its own `interaction` query
 * parameter names, or for the `return_to` path a caller with no interaction of
 * its own gave instead.
 *
 * @param ctx - The request context (provides `render`, `locale` and `intl`).
 * @returns The rendered sign-in page, or the `/u/error` page when neither was given.
 * @example
 * router.map(routes.hostedSignInShow, signInShow);
 */
export const signInShow = createAction(routes.hostedSignInShow, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId && !safeReturnTo(ctx)) {
		return redirectToErrorPage(ctx, ctx.intl.t("hostedError.invalidInteraction"));
	}

	return renderSignInPage(ctx, {
		loginHint: ctx.url.searchParams.get("login_hint"),
		forced: ctx.url.searchParams.get("forced") === "1",
		error: null,
		challenge: ctx.turnstileChallenge === true,
	});
});

/**
 * Verifies the submitted identifier and password, and on success sets the
 * `__Host-session` cookie and resumes the named interaction with the session it
 * just opened. A wrong password re-renders this same page with an error rather
 * than redirecting, so the browser never loses the interaction it was resuming.
 *
 * @param ctx - The request context (provides `formData`, `render` and `tenantStub`).
 * @returns The response `resumeAuthorization` reaches on a successful sign-in, or
 * this same page re-rendered with an error.
 * @example
 * router.map(routes.hostedSignInSubmit, signInSubmit);
 */
export const signInSubmit = createAction(routes.hostedSignInSubmit, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	let returnTo = safeReturnTo(ctx);
	let loginHint = ctx.url.searchParams.get("login_hint");
	let forced = ctx.url.searchParams.get("forced") === "1";
	let challenge = ctx.turnstileChallenge === true;

	if (!interactionId && !returnTo) {
		return redirectToErrorPage(ctx, ctx.intl.t("hostedError.invalidInteraction"));
	}

	let origin = requestOrigin(ctx.request);

	if (challenge) {
		let turnstilePassed = await passesConditionalTurnstileChallenge(
			env.TURNSTILE_SECRET_KEY,
			ctx.formData,
			getClientIP(ctx.request) ?? undefined,
			{ env, tenantId: ctx.tenant.id, country: origin.country ?? undefined },
		);
		if (!turnstilePassed) {
			return renderSignInPage(ctx, {
				loginHint,
				forced,
				challenge,
				error: ctx.intl.t("hostedSignIn.errors.turnstileFailed"),
			});
		}
	}

	let identifier = ctx.formData.get("identifier");
	let password = ctx.formData.get("password");
	let remembered = ctx.formData.get("remember") === "true";

	if (typeof identifier !== "string" || !identifier || typeof password !== "string" || !password) {
		return renderSignInPage(ctx, {
			loginHint,
			forced,
			challenge,
			error: ctx.intl.t("hostedSignIn.errors.invalidCredentials"),
		});
	}

	let trustedDeviceToken = await readTrustedDeviceToken(ctx.request);

	let signedIn = await ctx.tenantStub.signInWithPassword({
		identifier,
		password,
		remembered,
		trustedDeviceToken,
		...origin,
	});

	if (!signedIn.ok) {
		if (signedIn.reason === "invalid-credentials") {
			let spend = ctx.credentialRateLimit;
			if (spend) await spend.adapter.consume(spend.key, CREDENTIAL_FAILURE_SPEND);

			recordAttackSignal(env, {
				tenantId: ctx.tenant.id,
				surface: "credential",
				outcome: signedIn.retryAfter !== undefined ? "refused-backoff" : "refused-credential",
				reason: "invalid-credentials",
				country: origin.country ?? undefined,
			});
		}

		let error =
			signedIn.reason === "password_expired"
				? ctx.intl.t("hostedSignIn.errors.passwordExpired")
				: signedIn.reason === "dau_cap_reached"
					? ctx.intl.t("hostedSignIn.errors.dauCapReached")
					: ctx.intl.t("hostedSignIn.errors.invalidCredentials");
		return renderSignInPage(ctx, { loginHint, forced, challenge, error });
	}

	recordAttackSignal(env, {
		tenantId: ctx.tenant.id,
		surface: "credential",
		outcome: "succeeded",
		country: origin.country ?? undefined,
	});

	let sessionCookieHeader = await serializeSessionCookie(signedIn, remembered);

	if (signedIn.secondFactorRequired) {
		let url = new URL(routes.hostedSecondFactorShow.href(), ctx.request.url);
		if (interactionId) url.searchParams.set("interaction", interactionId);
		if (returnTo) url.searchParams.set("return_to", returnTo);
		url.searchParams.set("mode", signedIn.mustEnrolFactor ? "enrol" : "prove");
		let uiLocales = ctx.url.searchParams.get("ui_locales");
		if (uiLocales) url.searchParams.set("ui_locales", uiLocales);

		let response = new Response(null, { status: 302, headers: { Location: url.toString() } });
		response.headers.append("Set-Cookie", sessionCookieHeader);
		return response;
	}

	let response: Response;

	if (interactionId) {
		let outcome = await ctx.tenantStub.resumeAuthorization({
			interactionId,
			sessionId: signedIn.sessionId,
			now: Date.now(),
		});

		response = await respondToAuthorizationOutcome(ctx, outcome, {
			uiLocales: ctx.url.searchParams.get("ui_locales"),
		});
	} else {
		// `returnTo` is the only other way this action was reached — the top
		// guard already refused any request carrying neither.
		response = redirectToReturnTo(ctx, returnTo as string);
	}

	response.headers.append("Set-Cookie", sessionCookieHeader);
	return response;
});
