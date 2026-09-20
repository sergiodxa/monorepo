/**
 * The passkey ceremony's two JSON endpoints, posted to by the hydrated island on
 * `/u/sign-in`: begin issues a ceremony's options, verify spends the browser's
 * assertion, opens a session on success, and resolves where the browser goes
 * next — the same outcome-to-destination mapping every hosted screen shares,
 * answered as `{ redirect }` instead of an HTTP redirect since this is a `fetch()`
 * response the island reads to navigate itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { resolveOutcomeRedirect } from "~/app/http/controllers/hosted/outcome";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import { requestOrigin } from "~/app/lib/request-origin";
import routes from "~/routes/tenant";

/** The relying party id and origins a WebAuthn ceremony runs under: the current request's own host. */
function relyingParty(request: Request): { relyingPartyId: string; origins: string[] } {
	let url = new URL(request.url);
	return { relyingPartyId: url.hostname, origins: [url.origin] };
}

/**
 * Starts a usernameless passkey authentication ceremony.
 *
 * @param ctx - The request context (provides `tenantStub` and `request`).
 * @returns The ceremony id and options to run through the browser's credentials API.
 * @example
 * router.map(routes.hostedSignInPasskeyOptions, signInPasskeyOptions);
 */
export const signInPasskeyOptions = createAction(routes.hostedSignInPasskeyOptions, async (ctx) => {
	let ceremony = await ctx.tenantStub.beginPasskeyAuthentication(relyingParty(ctx.request));
	return json(ceremony);
});

let VerifyBodySchema = s.object({
	ceremonyId: s.string(),
	response: s.record(s.string(), s.any()),
});

/**
 * Spends a passkey ceremony's assertion, opens a session on success, sets the
 * `__Host-session` cookie, and resumes the interaction its `interaction` query
 * parameter names.
 *
 * @param ctx - The request context (provides `tenantStub`, `request` and `i18next`).
 * @returns `{ redirect }` naming where the island should navigate next, or
 * `{ error }` when the ceremony or the interaction did not resolve.
 * @example
 * router.map(routes.hostedSignInPasskeyVerify, signInPasskeyVerify);
 */
export const signInPasskeyVerify = createAction(routes.hostedSignInPasskeyVerify, async (ctx) => {
	let t = ctx.i18next.t;
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId) return json({ error: t("hostedError.invalidInteraction") }, { status: 400 });

	let parsed = s.parseSafe(VerifyBodySchema, await ctx.request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: t("hostedSignIn.errors.passkeyFailed") }, { status: 400 });
	}

	let signedIn = await ctx.tenantStub.signInWithPasskey({
		ceremonyId: parsed.value.ceremonyId,
		response: parsed.value.response as unknown as AuthenticationResponseJSON,
		remembered: true,
		...relyingParty(ctx.request),
		...requestOrigin(ctx.request),
	});

	if (!signedIn.ok) {
		let error =
			signedIn.reason === "dau_cap_reached"
				? t("hostedSignIn.errors.dauCapReached")
				: t("hostedSignIn.errors.passkeyFailed");
		return json({ error }, { status: 400 });
	}

	let outcome = await ctx.tenantStub.resumeAuthorization({
		interactionId,
		sessionId: signedIn.sessionId,
		now: Date.now(),
	});

	let redirect = resolveOutcomeRedirect(ctx, outcome, ctx.url.searchParams.get("ui_locales"));
	let body =
		redirect === null
			? {
					error:
						outcome.kind === "render"
							? outcome.description
							: t("hostedSignIn.errors.passkeyFailed"),
				}
			: { redirect };

	let response = json(body, { status: redirect === null ? 400 : 200 });
	response.headers.append("Set-Cookie", await serializeSessionCookie(signedIn, true));
	return response;
});
