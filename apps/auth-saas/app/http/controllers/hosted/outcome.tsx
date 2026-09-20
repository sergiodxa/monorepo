/**
 * Turns an `AuthorizationOutcome` into a `Response`, the one mapping `/authorize`,
 * `/u/sign-in` and `/u/consent` all share: `redirect` is a real `302` onto its
 * target; `authenticate` is a `302` to `/u/sign-in`; `consent` either renders the
 * consent screen inline (when the caller is already `/u/consent`) or `302`s
 * there. `render` is the one exception: `/authorize` has no verified redirect
 * target at all yet, so it renders `/u/error`'s content inline rather than
 * sending the browser anywhere; every other caller already stands on its own
 * hosted page and `302`s to `/u/error` instead, the same as any other outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import type { AuthorizationOutcome } from "~/database/authorization";
import type { ConsentScreen } from "~/database/consent";

import { ConsentPage } from "~/app/views/hosted/consent";
import { HostedDocument } from "~/app/views/hosted/document";
import { ErrorPage } from "~/app/views/hosted/error";
import { StepUpPage } from "~/app/views/hosted/step-up";
import routes from "~/routes/tenant";

export interface RespondToOutcomeOptions {
	/**
	 * Renders a `consent` outcome inline instead of redirecting to it. Only
	 * `/u/consent`'s own controllers pass this; every other caller reaches
	 * `/u/consent` through the redirect.
	 */
	renderConsentInline?: boolean;
	/** The consent screen's own form action, required whenever `renderConsentInline` is set. */
	consentAction?: string;
	/**
	 * Renders a `step-up` outcome inline instead of redirecting to it. Only
	 * `/u/step-up`'s own controllers pass this; every other caller reaches
	 * `/u/step-up` through the redirect. A subject with no factor is rendered by
	 * the caller directly instead — `respondToAuthorizationOutcome` only ever
	 * shows the code-entry state, since assembling the enrolment form needs a
	 * fresh `beginTotpEnrolment` call this mapper has no reason to make on every
	 * outcome it resolves.
	 */
	renderStepUpInline?: boolean;
	/** The step-up form's own action, required whenever `renderStepUpInline` is set and the subject holds a factor. */
	stepUpAction?: string;
	/**
	 * Renders a `render` outcome inline instead of redirecting to `/u/error`. Only
	 * `/authorize` passes this — the one caller with no verified redirect target
	 * to have landed the browser on in the first place.
	 */
	renderErrorInline?: boolean;
	/**
	 * The `ui_locales` value the current request carried, if any, copied onto a
	 * `/u/sign-in`, `/u/consent` or `/u/error` redirect so the language detector
	 * still sees it on the next request in the flow.
	 */
	uiLocales?: string | null;
}

/** Builds an absolute URL for one of this tenant's own routes, relative to the current request. */
function tenantUrl(ctx: RequestContext, path: string): URL {
	return new URL(path, ctx.request.url);
}

/**
 * A real `302` to `location`, with mutable headers — unlike `Response.redirect()`,
 * whose headers the platform guards as immutable, a caller here still needs to
 * append the `__Host-session` `Set-Cookie` a sign-in or a passkey verification
 * just opened.
 */
function redirectTo(location: string): Response {
	return new Response(null, { status: 302, headers: { Location: location } });
}

/**
 * Renders the `/u/error` screen's content for the given description, tagging it
 * with a fresh correlation id a support conversation can reference. Used both by
 * `/u/error` itself and, inline, by `/authorize`'s own `render`-class failures.
 *
 * @param ctx - The request context (provides `render`, `locale` and `i18next`).
 * @param description - The already-composed, developer-facing sentence the
 * failing operation answered with.
 * @returns The rendered error page, at `400`.
 */
export async function renderErrorPage(ctx: RequestContext, description: string): Promise<Response> {
	let t = ctx.i18next.t;
	let correlationId = crypto.randomUUID();

	return ctx.render(
		<HostedDocument title={t("hostedError.title")} locale={ctx.locale}>
			<ErrorPage t={t} description={description} correlationId={correlationId} />
		</HostedDocument>,
		{ status: 400 },
	);
}

/**
 * A real `302` to `/u/error`, carrying the failure's description as a query
 * parameter for `/u/error`'s own GET to render.
 *
 * @param ctx - The request context (provides `request`).
 * @param description - The already-composed, developer-facing sentence to show.
 * @param uiLocales - The `ui_locales` value to carry forward, if any.
 * @returns The redirect response.
 */
export function redirectToErrorPage(
	ctx: RequestContext,
	description: string,
	uiLocales?: string | null,
): Response {
	let url = tenantUrl(ctx, routes.hostedError.href());
	url.searchParams.set("description", description);
	if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
	return redirectTo(url.toString());
}

/**
 * Renders the `/u/consent` screen inline for a request that still needs a
 * decision.
 *
 * @param ctx - The request context (provides `render`, `locale` and `i18next`).
 * @param action - The consent form's own action, carrying the interaction id.
 * @param screen - The assembled consent screen to render.
 * @returns The rendered consent page.
 */
export async function renderConsentPage(
	ctx: RequestContext,
	action: string,
	screen: ConsentScreen,
): Promise<Response> {
	let t = ctx.i18next.t;

	return ctx.render(
		<HostedDocument
			title={t("hostedConsent.title", { clientName: screen.client.name })}
			locale={ctx.locale}
		>
			<ConsentPage t={t} action={action} screen={screen} />
		</HostedDocument>,
	);
}

/**
 * Renders the `/u/step-up` code-entry screen inline for a request that still
 * needs a fresh proof. A subject with no factor at all is not rendered here —
 * see {@link RespondToOutcomeOptions.renderStepUpInline}.
 *
 * @param ctx - The request context (provides `render`, `locale` and `i18next`).
 * @param action - The step-up form's own action, carrying the interaction id.
 * @param error - An error from a prior submission, if any.
 * @returns The rendered step-up page.
 */
export async function renderStepUpPage(
	ctx: RequestContext,
	action: string,
	error: string | null = null,
): Promise<Response> {
	let t = ctx.i18next.t;

	return ctx.render(
		<HostedDocument title={t("hostedStepUp.title")} locale={ctx.locale}>
			<StepUpPage t={t} action={action} error={error} />
		</HostedDocument>,
		error ? { status: 400 } : undefined,
	);
}

/**
 * Resolves the URL a `redirect`, `authenticate` or `consent` outcome sends the
 * browser to next — the piece the passkey verify endpoint also needs, since it
 * answers in JSON rather than an HTTP redirect of its own. A `render` outcome has
 * no such destination when rendered inline, so it resolves to `null` here;
 * `redirectToErrorPage` is `/u/error`'s own equivalent for that outcome.
 *
 * @param ctx - The request context (provides `request`).
 * @param outcome - The outcome to resolve a destination for.
 * @param uiLocales - The `ui_locales` value to carry forward, if any.
 * @returns The destination URL, or `null` for a `render` outcome.
 */
export function resolveOutcomeRedirect(
	ctx: RequestContext,
	outcome: AuthorizationOutcome,
	uiLocales?: string | null,
): string | null {
	if (outcome.kind === "redirect") return outcome.location;

	if (outcome.kind === "render") return null;

	if (outcome.kind === "authenticate") {
		let url = tenantUrl(ctx, routes.hostedSignInShow.href());
		url.searchParams.set("interaction", outcome.interactionId);
		if (outcome.loginHint) url.searchParams.set("login_hint", outcome.loginHint);
		if (outcome.forced) url.searchParams.set("forced", "1");
		if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
		return url.toString();
	}

	if (outcome.kind === "step-up") {
		let url = tenantUrl(ctx, routes.hostedStepUpShow.href());
		url.searchParams.set("interaction", outcome.interactionId);
		if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
		return url.toString();
	}

	// outcome.kind === "consent"
	let url = tenantUrl(ctx, routes.hostedConsentShow.href());
	url.searchParams.set("interaction", outcome.interactionId);
	if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
	return url.toString();
}

/**
 * Turns an `AuthorizationOutcome` into the `Response` it deserves.
 *
 * @param ctx - The request context (provides `render`, `locale`, `i18next` and `request`).
 * @param outcome - The outcome a `beginAuthorization`/`resumeAuthorization` call answered with.
 * @param options - Whether to render a `consent` or `render` outcome inline, and
 * the `ui_locales` value to carry forward onto a redirect.
 * @returns The response this outcome resolves to.
 */
export async function respondToAuthorizationOutcome(
	ctx: RequestContext,
	outcome: AuthorizationOutcome,
	options: RespondToOutcomeOptions = {},
): Promise<Response> {
	if (outcome.kind === "render") {
		return options.renderErrorInline
			? renderErrorPage(ctx, outcome.description)
			: redirectToErrorPage(ctx, outcome.description, options.uiLocales);
	}

	if (outcome.kind === "consent" && options.renderConsentInline) {
		if (!options.consentAction) throw new Error("renderConsentInline requires consentAction");
		return renderConsentPage(ctx, options.consentAction, outcome.screen);
	}

	if (outcome.kind === "step-up" && options.renderStepUpInline && outcome.screen.hasFactor) {
		if (!options.stepUpAction) throw new Error("renderStepUpInline requires stepUpAction");
		return renderStepUpPage(ctx, options.stepUpAction);
	}

	let location = resolveOutcomeRedirect(ctx, outcome, options.uiLocales);
	if (location === null) throw new Error("unreachable: a render outcome is handled above");

	return redirectTo(location);
}
