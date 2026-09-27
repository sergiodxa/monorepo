/**
 * `GET/POST /u/magic-link` — the request screen, whose `POST` mints the
 * `__Host-magic-link` nonce cookie, begins the attempt, sends whichever
 * message the outcome earns, and renders the same "check your email"
 * confirmation regardless of which of the three outcomes actually happened,
 * since the page, the status and the structure are the one thing this path
 * may never let vary by account existence. `GET/POST /u/magic-link/complete`
 * — the mailed link's own landing page, whose `GET` renders a form holding the
 * token in a hidden field rather than consuming it, and whose `POST` spends
 * either that token or a code typed back on the confirmation screen.
 *
 * Unlike `sign-in.tsx`'s own flow state, the interaction id and `return_to`
 * this screen resumes with are never read back off a later request's own
 * query: `beginMagicLinkSignIn` stores them against the attempt the moment it
 * mints one, and `completeMagicLinkSignIn` hands them back on success, so
 * nothing about where a completed sign-in resumes can be steered by a link
 * rewritten between the mailbox and the person who reads it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";
import type { RequestContext } from "remix/router";

import { Hex, sha256 } from "@sdxc/crypto";
import { getClientIP } from "@sdxc/get-client-ip";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import {
	redirectToErrorPage,
	redirectToReturnTo,
	respondToAuthorizationOutcome,
	safeReturnTo,
} from "~/app/http/controllers/hosted/outcome";
import { passesConditionalTurnstileChallenge } from "~/app/http/controllers/hosted/turnstile-guard";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import { recordAttackSignal } from "~/app/lib/attack-signals";
import {
	mintMagicLinkNonce,
	readMagicLinkNonce,
	serializeMagicLinkNonceCookie,
} from "~/app/lib/magic-link-nonce-cookie";
import { requestOrigin } from "~/app/lib/request-origin";
import { magicLinkSignInLink } from "~/app/mail/links";
import { MagicLinkNoAccountEmail } from "~/app/mail/magic-link-no-account-email";
import { MagicLinkSignInEmail } from "~/app/mail/magic-link-sign-in-email";
import { senderAddressFor, senderNameFromIssuer } from "~/app/mail/sender";
import { HostedDocument } from "~/app/views/hosted/document";
import { MagicLinkPage } from "~/app/views/hosted/magic-link";
import routes from "~/routes/tenant";

/** Builds an absolute URL for one of this tenant's routes, carrying the current request's query along. */
function actionUrl(ctx: RequestContext, path: string): string {
	let url = new URL(path, ctx.request.url);
	for (let [key, value] of ctx.url.searchParams) url.searchParams.set(key, value);
	return url.toString();
}

/** Builds the completion action's URL, carrying `ui_locales` alone — never a token, which travels only in the hidden field. */
function completeActionUrl(ctx: RequestContext, path: string): string {
	let url = new URL(path, ctx.request.url);
	let uiLocales = ctx.url.searchParams.get("ui_locales");
	if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
	return url.toString();
}

/** Where an invalid or wrong-browser completion offers to request a fresh one, carrying forward `ui_locales` alone. */
function freshRequestHref(ctx: RequestContext): string {
	let url = new URL(routes.hostedMagicLinkShow.href(), ctx.request.url);
	let uiLocales = ctx.url.searchParams.get("ui_locales");
	if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
	return url.toString();
}

let RequestSchema = f.object({
	email: f.field(s.string().pipe(checks.minLength(1), checks.email())),
});

/** SHA-256 of the raw nonce `mintMagicLinkNonce` minted, hex-encoded — the only form the tenant object ever sees. */
async function hashMagicLinkNonce(nonce: string): Promise<string> {
	let hashed = await sha256(nonce);
	if (isFailure(hashed)) throw new Error("magic link nonce hashing failed");
	return Hex.encode(hashed.data);
}

/** Renders the request-an-address form. */
function renderRequestForm(
	ctx: RequestContext,
	challenge: boolean,
	issues?: ReadonlyArray<Form.Issue>,
): Promise<Response> {
	let t = ctx.intl.t;

	return ctx.render(
		<HostedDocument title={t("hostedMagicLink.requestTitle")} locale={ctx.locale}>
			<MagicLinkPage
				t={t}
				state="request"
				action={actionUrl(ctx, routes.hostedMagicLinkSubmit.href())}
				challenge={challenge}
				turnstileSiteKey={env.TURNSTILE_SITE_KEY}
				issues={issues}
			/>
		</HostedDocument>,
		issues?.length ? { status: 400 } : undefined,
	);
}

/** Renders the invalid/expired-credential screen, shared by every completion path that lands on it. */
function renderInvalid(ctx: RequestContext): Promise<Response> {
	let t = ctx.intl.t;

	return ctx.render(
		<HostedDocument title={t("hostedMagicLink.invalid.heading")} locale={ctx.locale}>
			<MagicLinkPage t={t} state="invalid" requestHref={freshRequestHref(ctx)} />
		</HostedDocument>,
		{ status: 400 },
	);
}

/** Renders the confirmation every one of `beginMagicLinkSignIn`'s three outcomes shares. */
function renderConfirmation(
	ctx: RequestContext,
	options: { error?: string | null } = {},
): Promise<Response> {
	let t = ctx.intl.t;

	return ctx.render(
		<HostedDocument title={t("hostedMagicLink.confirmation.heading")} locale={ctx.locale}>
			<MagicLinkPage
				t={t}
				state="confirmation"
				codeAction={completeActionUrl(ctx, routes.hostedMagicLinkCompleteSubmit.href())}
				error={options.error ?? null}
			/>
		</HostedDocument>,
		options.error ? { status: 400 } : undefined,
	);
}

/**
 * Renders the request form for the interaction its own `interaction` query
 * parameter names, or for the `return_to` path a caller with no interaction of
 * its own gave instead.
 *
 * @param ctx - The request context (provides `render`, `locale` and `intl`).
 * @returns The rendered magic-link request screen, or the `/u/error` page when
 * neither was given.
 * @example
 * router.map(routes.hostedMagicLinkShow, magicLinkShow);
 */
export const magicLinkShow = createAction(routes.hostedMagicLinkShow, async (ctx) => {
	let interactionId = ctx.url.searchParams.get("interaction");
	if (!interactionId && !safeReturnTo(ctx)) {
		return redirectToErrorPage(ctx, ctx.intl.t("hostedError.invalidInteraction"));
	}

	return renderRequestForm(ctx, ctx.turnstileChallenge === true);
});

/**
 * Begins the attempt, mints and sets the browser nonce cookie, sends whichever
 * message the outcome earns, and renders the shared confirmation — the request,
 * the response's status and its structure never vary by whether the address
 * resolved to a subject, only what (if anything) lands in the mailbox does. The
 * interaction id or `return_to` this request names is stored against the
 * attempt itself, so a later completion resumes from there rather than from
 * anything its own request carries.
 *
 * @param ctx - The request context (provides `formData`, `render` and `tenantStub`).
 * @returns The confirmation screen, identical across every outcome, or the
 * request form re-rendered with a validation or Turnstile error.
 * @example
 * router.map(routes.hostedMagicLinkSubmit, magicLinkSubmit);
 */
export const magicLinkSubmit = createAction(routes.hostedMagicLinkSubmit, async (ctx) => {
	let t = ctx.intl.t;
	let interactionId = ctx.url.searchParams.get("interaction");
	let returnTo = safeReturnTo(ctx);
	let challenge = ctx.turnstileChallenge === true;

	if (!interactionId && !returnTo) {
		return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));
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
			let turnstileIssue = [{ message: t("hostedMagicLink.errors.turnstileFailed") }];
			return renderRequestForm(ctx, challenge, turnstileIssue);
		}
	}

	let parsed = s.parseSafe(RequestSchema, ctx.formData);
	if (!parsed.success) return renderRequestForm(ctx, challenge, parsed.issues);

	let nonce = mintMagicLinkNonce();
	let nonceHash = await hashMagicLinkNonce(nonce);

	let begun = await ctx.tenantStub.beginMagicLinkSignIn({
		address: parsed.value.email,
		locale: ctx.locale,
		browserNonceHash: nonceHash,
		interactionId,
		returnTo,
	});

	let tenantName = senderNameFromIssuer(ctx.tenant.issuer);

	if (begun.message === "sign_in") {
		await ctx.email.send(
			new MagicLinkSignInEmail({
				email: parsed.value.email,
				url: magicLinkSignInLink(ctx, begun.token),
				code: begun.code,
				tenantName,
				t,
			}),
			{ from: senderAddressFor(ctx) },
		);
	} else if (begun.message === "no_account") {
		await ctx.email.send(
			new MagicLinkNoAccountEmail({ email: parsed.value.email, tenantName, t }),
			{ from: senderAddressFor(ctx) },
		);
	}

	let response = await renderConfirmation(ctx);
	response.headers.append("Set-Cookie", await serializeMagicLinkNonceCookie(nonce));
	return response;
});

/**
 * The mailed link's own landing page: renders a form holding the token in a
 * hidden field, consuming nothing on this `GET`. The tenant's security policy
 * sends `Referrer-Policy: no-referrer`, keeping the token in this URL out of
 * `Referer`.
 *
 * @param ctx - The request context (provides `render`, `locale` and `intl`).
 * @returns The rendered landing page, or a redirect back to the request screen
 * when this request carries no token to land on.
 * @example
 * router.map(routes.hostedMagicLinkCompleteShow, magicLinkCompleteShow);
 */
export const magicLinkCompleteShow = createAction(
	routes.hostedMagicLinkCompleteShow,
	async (ctx) => {
		let token = ctx.url.searchParams.get("token");
		if (!token) {
			return new Response(null, {
				status: 302,
				headers: { Location: freshRequestHref(ctx) },
			});
		}

		let t = ctx.intl.t;

		return ctx.render(
			<HostedDocument title={t("hostedMagicLink.tokenLanding.heading")} locale={ctx.locale}>
				<MagicLinkPage
					t={t}
					state="tokenLanding"
					action={completeActionUrl(ctx, routes.hostedMagicLinkCompleteSubmit.href())}
					token={token}
				/>
			</HostedDocument>,
		);
	},
);

/**
 * Spends the token the landing page's hidden field carries, or the code typed
 * back on the confirmation screen, reading the bound browser's nonce off its
 * own cookie. On success, opens the session and resumes the interaction or
 * `return_to` the attempt itself was minted with, or sends the browser into
 * the second-factor flow first when the subject holds one.
 *
 * @param ctx - The request context (provides `formData`, `render`, `request` and `tenantStub`).
 * @returns The response the resumed interaction or `return_to` reaches, a
 * redirect into the second-factor flow, or this flow's own error screens.
 * @example
 * router.map(routes.hostedMagicLinkCompleteSubmit, magicLinkCompleteSubmit);
 */
export const magicLinkCompleteSubmit = createAction(
	routes.hostedMagicLinkCompleteSubmit,
	async (ctx) => {
		let t = ctx.intl.t;
		let token = ctx.formData.get("token");
		let code = ctx.formData.get("code");

		let credential =
			typeof token === "string" && token.length > 0
				? ({ kind: "link", token } as const)
				: typeof code === "string" && code.length > 0
					? ({ kind: "code", code } as const)
					: null;

		if (!credential) return renderInvalid(ctx);

		let nonce = await readMagicLinkNonce(ctx.request);
		let origin = requestOrigin(ctx.request);

		if (!nonce) return renderInvalid(ctx);

		let completed = await ctx.tenantStub.completeMagicLinkSignIn({
			credential,
			browserNonce: nonce,
			userAgentHash: origin.userAgent,
		});

		if (completed.outcome === "invalid") return renderInvalid(ctx);

		if (completed.outcome === "wrong_browser") {
			return ctx.render(
				<HostedDocument title={t("hostedMagicLink.wrongBrowser.heading")} locale={ctx.locale}>
					<MagicLinkPage t={t} state="wrongBrowser" requestHref={freshRequestHref(ctx)} />
				</HostedDocument>,
				{ status: 400 },
			);
		}

		if (completed.outcome === "bad_code") {
			if (completed.attemptsLeft <= 0) return renderInvalid(ctx);

			return renderConfirmation(ctx, {
				error: t("hostedMagicLink.errors.badCode", { attemptsLeft: completed.attemptsLeft }),
			});
		}

		if (completed.outcome === "dau_cap_reached") {
			return ctx.render(
				<HostedDocument title={t("hostedMagicLink.requestTitle")} locale={ctx.locale}>
					<MagicLinkPage t={t} state="dauCapReached" />
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

		let sessionCookieHeader = await serializeSessionCookie(completed, true);

		if (completed.secondFactorRequired) {
			let url = new URL(routes.hostedSecondFactorShow.href(), ctx.request.url);
			if (completed.interactionId) url.searchParams.set("interaction", completed.interactionId);
			if (completed.returnTo) url.searchParams.set("return_to", completed.returnTo);
			url.searchParams.set("mode", "prove");
			let uiLocales = ctx.url.searchParams.get("ui_locales");
			if (uiLocales) url.searchParams.set("ui_locales", uiLocales);

			let response = new Response(null, { status: 302, headers: { Location: url.toString() } });
			response.headers.append("Set-Cookie", sessionCookieHeader);
			return response;
		}

		let response: Response;

		if (completed.interactionId) {
			let outcome = await ctx.tenantStub.resumeAuthorization({
				interactionId: completed.interactionId,
				sessionId: completed.sessionId,
				now: Date.now(),
			});

			response = await respondToAuthorizationOutcome(ctx, outcome, {
				uiLocales: ctx.url.searchParams.get("ui_locales"),
			});
		} else if (completed.returnTo) {
			response = redirectToReturnTo(ctx, completed.returnTo);
		} else {
			return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));
		}

		response.headers.append("Set-Cookie", sessionCookieHeader);
		return response;
	},
);
