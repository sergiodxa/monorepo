/**
 * The authorization endpoint. `GET` validates a request, enforces `prompt`, issues a
 * code straight away for somebody already signed in (SSO), and otherwise parks the
 * request in the session and renders the sign-in page. `POST` completes a sign-in.
 *
 * PKCE is bound here: the challenge is carried through the session for the login round
 * trip and stored with the code, which is what makes the token endpoint's check run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { getClientIP } from "@pkg/get-client-ip";
import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { generateUUID } from "@pkg/uuid";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

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
 * Locale key per RFC 6749 error code a refused credential sign-in can carry. The
 * engine's own descriptions stay internal diagnostics and the stable `code` is what
 * crosses into the UI; any code beyond these three falls back to a generic message.
 */
const SIGN_IN_ERROR_KEYS: Readonly<Record<string, string>> = {
	missing_validation: "authorize.errors.missingValidation",
	access_denied: "authorize.errors.accessDenied",
	internal_server_error: "authorize.errors.serverError",
};

/** The message shown for any error code beyond the mapped ones. */
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
 * token. An unreadable token clears both tokens, so a session left over from an older
 * format reads as signed out and the request carries on.
 */
function currentSubjectId(): string | null {
	let accessToken = getAccessToken();
	if (!accessToken) return null;

	let subjectId = getSubjectFromAccessToken(accessToken);
	if (!subjectId) unsetTokens();

	return subjectId;
}

/**
 * The PKCE challenge an authorization request commits to. RFC 7636 §4.3 defaults the
 * method to `plain` when omitted; this server defaults to `S256`, the stronger of the
 * two and the one every client library sending a challenge here uses.
 *
 * @returns The challenge; `undefined` for a request carrying none, whose code redeems
 * with the verifier omitted, and `null` for a method beyond the two implemented here.
 */
function readPkce(query: AuthorizeQuery): OIDC.Pkce | null | undefined {
	if (!query.code_challenge) return undefined;

	let method = query.code_challenge_method ?? "S256";
	if (!CODE_CHALLENGE_METHODS.includes(method)) return null;

	return { challenge: query.code_challenge, method: method as OIDC.Pkce["method"] };
}

/**
 * Sends an OAuth error back to the client's redirect URI, in the response mode it
 * asked for. Callers validate the redirect URI against the registration first, so an
 * error only ever reaches an address the client registered.
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
 * authorization request for it, and redirects to itself carrying that request, so a
 * bare `/authorize` reaches the account area through the same flow relying parties use.
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
		 * a code (SSO) or renders the sign-in page. Redirect URIs match the registration
		 * exactly, and the IP budget is spent on the first request carrying parameters.
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

			let limited = await spendRateLimit(limiters.authorize, getClientIP(ctx.request) ?? "unknown");
			if (limited) return limited;

			let client = await Client.findById(db, query.client_id);
			if (!client) {
				ctx.logger.info("authz_invalid_client", { clientId: query.client_id });
				return notFound({ message: "Client not found" });
			}

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

			if (query.prompt?.includes("none") && !subjectId) {
				ctx.logger.info("authz_prompt_none_login_required", { clientId: client.id });
				return await errorRedirect(ctx, query, "login_required", "User is not authenticated");
			}

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

			if (query.provider === "github") {
				ctx.logger.info("oauth_login_started", { provider: "github" });
				return await startGitHubLogin(ctx);
			}

			return signInPage(ctx, client, authz);
		}),

		/**
		 * POST /authorize — signs a person in with email and password, then answers the
		 * authorization request parked in their session. A refusal logs the error code
		 * alone. This server's own client keeps its parked request for its callback.
		 */
		action: inject([Database, RateLimiters] as const, async (db, limiters) => {
			let ctx = getContext();

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
				ctx.logger.info("authz_credential_login_failed", { error: login.error.code });

				let client = await Client.findById(db, authz.clientId);
				if (!client) return badRequest({ message: "Invalid request" });

				return signInPage(ctx, client, authz, signInErrorMessage(ctx, login.error.code));
			}

			ctx.logger.info("authz_credential_login_success", { subjectId: login.data.subjectId });

			await notifyNewSignIn(ctx, db, login.data.subjectId);

			await sendVerificationEmail(ctx, db, login.data.subjectId);

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
