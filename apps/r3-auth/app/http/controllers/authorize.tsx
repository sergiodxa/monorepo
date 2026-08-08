/**
 * The authorization endpoint. `GET` validates an authorization request, enforces the
 * `prompt` values, issues a code straight away for somebody already signed in (SSO),
 * and otherwise parks the request in the session and renders the sign-in page. `POST`
 * completes a credential sign-in and answers the parked request.
 *
 * It is also where PKCE is bound: the challenge arrives here, is carried through the
 * session for the login round trip, and is stored with the code, which is what makes
 * the token endpoint's verifier check run at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { getClientIP } from "@pkg/get-client-ip";
import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { generateUUID } from "@pkg/uuid";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { OIDC } from "~/app/auth/oidc-provider";
import type { AuthzState, ResponseMode } from "~/app/http/middleware/session";
import type { AuthorizeQuery } from "~/app/http/validators/authorize";
import type { SelectClient } from "~/database/schema";

import { createOidcProvider } from "~/app/auth/repository";
import { AUTH_SERVER_CLIENT_ID, ISSUER } from "~/app/config";
import Client from "~/app/data/client";
import {
	getAccessToken,
	getAuthz,
	setAuthz,
	unsetAuthz,
	unsetTokens,
} from "~/app/http/middleware/session";
import { authorizationResponse } from "~/app/http/responses/authorization-response";
import { AuthorizeFormSchema, AuthorizeQuerySchema } from "~/app/http/validators/authorize";
import { getSubjectFromAccessToken } from "~/app/services/access-token-claims";
import { sendVerificationEmail } from "~/app/services/email-verification";
import { startGitHubLogin } from "~/app/services/github-login";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import { notifyNewSignIn } from "~/app/services/sign-in-alert";
import DocumentLayout from "~/resources/layouts/document";
import AuthorizeView from "~/resources/views/authorize";
import routes from "~/routes/web";

/** PKCE challenge methods this server implements, as discovery advertises them. */
const CODE_CHALLENGE_METHODS: readonly string[] = ["S256", "plain"];

/**
 * Locale key per RFC 6749 error code a refused credential sign-in can carry.
 *
 * The engine is framework-agnostic and knows nothing about languages, so its error
 * descriptions stay internal diagnostics and the stable `code` is what crosses into
 * the UI. These three are every code `loginWithCredential` can fail with; anything
 * else falls back to the generic message.
 */
const SIGN_IN_ERROR_KEYS: Readonly<Record<string, string>> = {
	missing_validation: "authorize.errors.missingValidation",
	access_denied: "authorize.errors.accessDenied",
	internal_server_error: "authorize.errors.serverError",
};

/** The generic message shown for an error code with no message of its own. */
const SIGN_IN_ERROR_FALLBACK_KEY = "authorize.forms.error";

/**
 * Translates a refused sign-in into the sentence shown above the form.
 *
 * @param code - The `error` value the engine reported.
 */
function signInErrorMessage(ctx: RequestContext, code: string): string {
	return ctx.i18next.t(SIGN_IN_ERROR_KEYS[code] ?? SIGN_IN_ERROR_FALLBACK_KEY);
}

/**
 * The subject signed in to this server itself, read from the session's own access
 * token. A token that cannot be read clears both tokens, so a session left over from
 * an older format becomes "signed out" rather than a request that keeps failing.
 */
function currentSubjectId(): string | null {
	let accessToken = getAccessToken();
	if (!accessToken) return null;

	let subjectId = getSubjectFromAccessToken(accessToken);
	if (!subjectId) unsetTokens();

	return subjectId;
}

/**
 * The PKCE challenge an authorization request commits to.
 *
 * Per RFC 7636 §4.3 the method defaults to `plain` when omitted; this server defaults
 * to `S256` instead, which is the stronger of the two and what every client library
 * sending a challenge here actually uses. Returns `undefined` for a request carrying
 * no challenge at all, whose code then redeems without a verifier.
 *
 * @returns The challenge, `null` when the method is not one this server implements.
 */
function readPkce(query: AuthorizeQuery): OIDC.Pkce | null | undefined {
	if (!query.code_challenge) return undefined;

	let method = query.code_challenge_method ?? "S256";
	if (!CODE_CHALLENGE_METHODS.includes(method)) return null;

	return { challenge: query.code_challenge, method: method as OIDC.Pkce["method"] };
}

/**
 * Sends an OAuth error back to the client's redirect URI, in the response mode it
 * asked for.
 *
 * The redirect URI has always been validated against the registration before this
 * runs — an error may never be delivered to an address the client did not register.
 */
async function errorRedirect(
	ctx: RequestContext,
	query: { redirect_uri: string; state: string; response_mode: ResponseMode },
	error: string,
	description: string,
): Promise<Response> {
	return await authorizationResponse(
		ctx,
		query.redirect_uri,
		{ state: query.state, iss: ISSUER, error, error_description: description },
		query.response_mode,
	);
}

/**
 * Renders the sign-in page for a parked authorization request.
 *
 * @param error - Why the previous attempt was refused, already translated, when this
 * is a re-render.
 */
function signInPage(ctx: RequestContext, client: SelectClient, authz: AuthzState, error?: string) {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("authorize.header.title", { client: client.name })}>
			<AuthorizeView
				clientName={client.name}
				clientDescription={client.description}
				clientLogoUrl={client.logo_url}
				title={ctx.i18next.t("authorize.header.titleShort")}
				description={ctx.i18next.t("authorize.header.description")}
				showRegistration={authz.prompt?.includes("create") ?? false}
				error={error ?? null}
				labels={{
					name: {
						label: ctx.i18next.t("authorize.forms.credentials.fields.name.label"),
						placeholder: ctx.i18next.t("authorize.forms.credentials.fields.name.placeholder"),
					},
					username: {
						label: ctx.i18next.t("authorize.forms.credentials.fields.username.label"),
						placeholder: ctx.i18next.t("authorize.forms.credentials.fields.username.placeholder"),
					},
					email: {
						label: ctx.i18next.t("authorize.forms.credentials.fields.email.label"),
						placeholder: ctx.i18next.t("authorize.forms.credentials.fields.email.placeholder"),
					},
					password: {
						label: ctx.i18next.t("authorize.forms.credentials.fields.password.label"),
						placeholder: ctx.i18next.t("authorize.forms.credentials.fields.password.placeholder"),
					},
					submit: ctx.i18next.t("authorize.forms.credentials.cta"),
					github: ctx.i18next.t("authorize.forms.github.cta"),
					separator: ctx.i18next.t("authorize.forms.separator"),
					forgotPassword: ctx.i18next.t("password.forgot.link"),
				}}
			/>
		</DocumentLayout>,
	);
}

/**
 * Starts this server's own sign-in: ensures its client registration exists, parks an
 * authorization request for it, and redirects to itself carrying that request.
 *
 * This is how a visit to a bare `/authorize` becomes a real OAuth flow, so the account
 * area is reached through the same code path relying parties use rather than a
 * privileged shortcut.
 */
async function selfRedirect(ctx: RequestContext, db: Database): Promise<Response> {
	let client = await Client.ensureAuthServerClient(db, ctx.url);
	let state = generateUUID();

	setAuthz({ clientId: client.id, state, redirectUri: client.redirect_uri });

	let url = new URL(routes.authorize.index.href(), ctx.url.origin);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", client.id);
	url.searchParams.set("redirect_uri", client.redirect_uri);
	url.searchParams.set("state", state);

	ctx.logger.info("authz_self_redirect", { clientId: client.id });

	return redirect(url.toString(), { status: redirect.Status.SeeOther });
}

export default createController(routes.authorize, {
	actions: {
		/**
		 * GET /authorize — validates an authorization request and either answers it with
		 * a code (SSO) or renders the sign-in page.
		 */
		index: inject([Database, RateLimiters] as const, async (db, limiters) => {
			let ctx = getContext();

			let subjectId = currentSubjectId();
			let result = await validate(ctx.url.searchParams, AuthorizeQuerySchema);

			if (isFailure(result)) {
				if (subjectId) {
					ctx.logger.info("authz_already_logged_in", { subjectId });
					return redirect(routes.account.sessions.index.href(), {
						status: redirect.Status.SeeOther,
					});
				}

				return await selfRedirect(ctx, db);
			}

			let query = result.data;

			// By IP, and here rather than at the top of the handler: this endpoint is the
			// enumeration surface for client ids and redirect URIs, and enumerating means
			// naming one — so the budget is spent by the first request that is a real
			// authorization request, immediately before the lookup that would answer it.
			//
			// The branch above costs nothing, which is what keeps a probe out of a person's
			// budget: `/` redirects here, so a monitor, a crawler or a bodyless `HEAD` on the
			// bare domain arrives with no query at all and gets the parameterless
			// self-redirect. It reads and writes only this server's own client registration,
			// which is one fixed row and tells a caller nothing they did not already know.
			// An attacker probing client ids or redirect URIs has to send the parameters, so
			// they are limited from their very first attempt exactly as before.
			let limited = await spendRateLimit(limiters.authorize, getClientIP(ctx.request) ?? "unknown");
			if (limited) return limited;

			let client = await Client.findById(db, query.client_id);
			if (!client) {
				ctx.logger.info("authz_invalid_client", { clientId: query.client_id });
				return notFound({ message: "Client not found" });
			}

			// Exact match, never a prefix or an origin comparison: an attacker who can
			// register a redirect URI that merely starts with a registered one would
			// receive codes issued for the real client.
			if (client.redirect_uri !== query.redirect_uri) {
				ctx.logger.info("authz_redirect_uri_mismatch", { clientId: query.client_id });
				return notFound({ message: "Invalid redirect URI" });
			}

			let pkce = readPkce(query);
			if (pkce === null) {
				ctx.logger.info("authz_unsupported_code_challenge_method", { clientId: client.id });
				return await errorRedirect(
					ctx,
					query,
					"invalid_request",
					"Unsupported code_challenge_method",
				);
			}

			// `prompt=none` means "answer without showing anything": no session, no answer.
			if (query.prompt?.includes("none") && !subjectId) {
				ctx.logger.info("authz_prompt_none_login_required", { clientId: client.id });
				return await errorRedirect(ctx, query, "login_required", "User is not authenticated");
			}

			// `prompt=login` forces re-authentication, which means skipping SSO. `consent`
			// and `select_account` are accepted and change nothing: this server records a
			// grant on first authorization and has one account per session, so there is
			// nothing to ask about.
			let forceLogin = query.prompt?.includes("login") ?? false;

			if (subjectId && !forceLogin) {
				let code = await createOidcProvider(db).generateAuthzCode({
					subjectId,
					clientId: client.id,
					ip: getClientIP(ctx.request),
					ua: ctx.request.headers.get("user-agent"),
					redirectUri: query.redirect_uri,
					state: query.state,
					nonce: query.nonce,
					scope: query.scope,
					responseMode: query.response_mode,
					pkce,
				});

				if (code.status === "failure") {
					ctx.logger.error("authz_sso_code_failed", { subjectId, error: code.error.code });
					return await errorRedirect(ctx, query, code.error.code, code.error.description);
				}

				ctx.logger.info("authz_sso_code_generated", { subjectId, clientId: client.id });

				// No new-sign-in notice here, even though a session row is opened. Nobody
				// authenticated on this path: the browser already held a session this server
				// issued, and whoever owns it was told about that one. Mailing here would put a
				// message in an inbox every time any relying party is authorized — including
				// each `prompt=none` renewal a client runs in a hidden iframe — which is a
				// notice nobody reads and a send quota spent on it.

				return await authorizationResponse(
					ctx,
					code.data.redirectUri,
					code.data.params,
					code.data.responseMode,
				);
			}

			let authz: AuthzState = {
				clientId: query.client_id,
				state: query.state,
				redirectUri: query.redirect_uri,
				nonce: query.nonce,
				scope: query.scope,
				responseMode: query.response_mode,
				prompt: query.prompt,
				codeChallenge: pkce?.challenge,
				codeChallengeMethod: pkce?.method,
			};

			ctx.logger.info("authz_session_started", { clientId: query.client_id });
			setAuthz(authz);

			// Started here rather than by redirecting to the provider route, which only
			// answers `POST`: a redirect is followed with `GET`, which that route does not
			// serve. An unrecognized provider falls through to the sign-in page instead of
			// erroring, since a page offering every way in is the better answer.
			if (query.provider === "github") {
				ctx.logger.info("oauth_login_started", { provider: "github" });
				return await startGitHubLogin(ctx);
			}

			return signInPage(ctx, client, authz);
		}),

		/**
		 * POST /authorize — signs a person in with email and password, then answers the
		 * authorization request parked in their session.
		 */
		action: inject([Database, RateLimiters] as const, async (db, limiters) => {
			let ctx = getContext();

			// The strictest of the five budgets: this is where password attempts land.
			let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
			if (limited) return limited;

			let authz = getAuthz();
			if (!authz) {
				ctx.logger.info("authz_action_missing_session");
				return badRequest({ message: "Invalid request" });
			}

			let result = await validate(ctx.formData, AuthorizeFormSchema);
			if (isFailure(result)) {
				ctx.logger.info("authz_action_validation_failed");
				return badRequest({ message: "Invalid request" });
			}

			let login = await createOidcProvider(db).loginWithCredential({
				email: result.data.email,
				password: result.data.password,
				name: result.data.name,
				username: result.data.username,
				clientId: authz.clientId,
				ip: getClientIP(ctx.request),
				ua: ctx.request.headers.get("user-agent"),
				redirectUri: authz.redirectUri,
				state: authz.state,
				nonce: authz.nonce,
				scope: authz.scope,
				responseMode: authz.responseMode,
				pkce: authz.codeChallenge
					? { challenge: authz.codeChallenge, method: authz.codeChallengeMethod ?? "S256" }
					: null,
			});

			if (login.status === "failure") {
				// The code is logged, never the address or the password it was tried with.
				ctx.logger.info("authz_credential_login_failed", { error: login.error.code });

				let client = await Client.findById(db, authz.clientId);
				if (!client) return badRequest({ message: "Invalid request" });

				// The engine's own description never reaches the page: it is English-only and,
				// for an internal failure, carries the underlying exception's message.
				return signInPage(ctx, client, authz, signInErrorMessage(ctx, login.error.code));
			}

			ctx.logger.info("authz_credential_login_success", { subjectId: login.data.subjectId });

			// Queued, never awaited: the notice is flushed after the response, so a refused
			// delivery cannot turn a completed sign-in into an error the person sees.
			await notifyNewSignIn(ctx, db, login.data.subjectId);

			// Only ever after a *successful* sign-in, and only from here: the refusal branch
			// above returns without reaching this line, so an address somebody merely typed at
			// the form is never mailed. It decides for itself whether a message is needed, from
			// the one condition — `email_verified_at` is null — so this path does not have to
			// know how they signed in. A registration lands here too, which is what gives a
			// brand-new password account its first verification message.
			await sendVerificationEmail(ctx, db, login.data.subjectId);

			// Cleared once answered, except for this server's own client: its callback is
			// the next request in the same flow and still has to check the `state` and the
			// redirect URI this request parked.
			if (authz.clientId !== AUTH_SERVER_CLIENT_ID) unsetAuthz();

			return await authorizationResponse(
				ctx,
				login.data.redirectUri,
				login.data.params,
				login.data.responseMode,
			);
		}),
	},
});
