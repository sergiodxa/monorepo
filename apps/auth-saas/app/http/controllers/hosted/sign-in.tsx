/**
 * `GET/POST /u/sign-in` — identifier and password, and a passkey button (see
 * `sign-in-passkey.tsx` for the ceremony's own two endpoints). The interaction id,
 * `login_hint`, `forced` and `ui_locales` all round-trip as query parameters on
 * this page's own URL, carried onto its form and passkey actions unchanged, so
 * the flow state itself never leaves the interaction row a person can edit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { createAction } from "remix/router";

import {
	redirectToErrorPage,
	respondToAuthorizationOutcome,
} from "~/app/http/controllers/hosted/outcome";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import { requestOrigin } from "~/app/lib/request-origin";
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
	input: { loginHint: string | null; forced: boolean; error: string | null },
): Promise<Response> {
	let t = ctx.i18next.t;

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
			/>
		</HostedDocument>,
		input.error ? { status: 400 } : undefined,
	);
}

/**
 * Renders the sign-in form for the interaction its own `interaction` query
 * parameter names.
 *
 * @param ctx - The request context (provides `render`, `locale` and `i18next`).
 * @returns The rendered sign-in page, or the `/u/error` page when no interaction
 * was named to resume.
 * @example
 * router.map(routes.hostedSignInShow, signInShow);
 */
export const signInShow = createAction(routes.hostedSignInShow, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) {
		return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));
	}

	return renderSignInPage(ctx, {
		loginHint: ctx.url.searchParams.get("login_hint"),
		forced: ctx.url.searchParams.get("forced") === "1",
		error: null,
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
	let loginHint = ctx.url.searchParams.get("login_hint");
	let forced = ctx.url.searchParams.get("forced") === "1";

	if (!interactionId) {
		return redirectToErrorPage(ctx, ctx.i18next.t("hostedError.invalidInteraction"));
	}

	let identifier = ctx.formData.get("identifier");
	let password = ctx.formData.get("password");
	let remembered = ctx.formData.get("remember") === "true";

	if (typeof identifier !== "string" || !identifier || typeof password !== "string" || !password) {
		return renderSignInPage(ctx, {
			loginHint,
			forced,
			error: ctx.i18next.t("hostedSignIn.errors.invalidCredentials"),
		});
	}

	let signedIn = await ctx.tenantStub.signInWithPassword({
		identifier,
		password,
		remembered,
		...requestOrigin(ctx.request),
	});

	if (!signedIn.ok) {
		let error =
			signedIn.reason === "password_expired"
				? ctx.i18next.t("hostedSignIn.errors.passwordExpired")
				: ctx.i18next.t("hostedSignIn.errors.invalidCredentials");
		return renderSignInPage(ctx, { loginHint, forced, error });
	}

	let outcome = await ctx.tenantStub.resumeAuthorization({
		interactionId,
		sessionId: signedIn.sessionId,
		now: Date.now(),
	});

	let response = await respondToAuthorizationOutcome(ctx, outcome, {
		uiLocales: ctx.url.searchParams.get("ui_locales"),
	});
	response.headers.append("Set-Cookie", await serializeSessionCookie(signedIn, remembered));
	return response;
});
