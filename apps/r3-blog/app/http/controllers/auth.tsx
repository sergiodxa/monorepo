import { JWK } from "@edgefirst-dev/jwt";
import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";
import { startExternalAuth } from "remix/auth";
import { Database } from "remix/data-table";
import { Session } from "remix/session";

import { createProvider, exchangeCodeForIdToken } from "~/app/auth/services/oauth";
import { verifyIdToken } from "~/app/auth/value-objects/id-token";
import { getIdToken, isAuthenticated, login, logout, setIdToken } from "~/app/http/middleware/auth";
import { getEnv } from "~/app/http/middleware/env";
import { view } from "~/app/infrastructure/view";
import { User } from "~/app/repositories/user";
import { LoginView } from "~/resources/views/auth/login";
import { LogoutView } from "~/resources/views/auth/logout";
import routes from "~/routes/web";

interface OAuthTransaction {
	provider: string;
	state: string;
	codeVerifier: string;
	returnTo?: string;
}

let idTokenVerificationKey = JWK.importRemote(
	new URL("https://auth.sergiodxa.com/.well-known/jwks.json"),
	{ alg: JWK.Algoritm.ES256 },
);

/**
 * Orchestrates the authentication flow for login, logout, and OAuth callback routes.
 * Keeps login/logout pages guest-only and completes a full PKCE transaction on callback.
 *
 * @example
 * GET /auth/login
 * @example
 * GET /auth/callback?code=...&state=...
 */
export default controller<typeof routes.auth>({
	middleware: [
		/**
		 * Guards guest-only auth pages by short-circuiting authenticated requests.
		 *
		 * Non-obvious behavior: this middleware only applies to login/logout routes;
		 * the callback route has its own middleware list and can complete sign-in.
		 *
		 * @returns A redirect response when a session already exists.
		 */
		async () => {
			if (isAuthenticated()) {
				return redirect(routes.cms.dashboard.href(), { status: redirect.Status.SeeOther });
			}
		},
	],
	actions: {
		login: {
			middleware: [],
			actions: {
				/**
				 * Renders the login screen where users can start external authentication.
				 *
				 * @returns The login HTML view without mutating session state.
				 */
				async index() {
					return view(LoginView, {});
				},

				/**
				 * Starts an OAuth authorization transaction with PKCE and optional post-login redirect.
				 *
				 * Contract: `next` is treated as optional user intent and is persisted by the auth
				 * transaction for callback-time validation and safe redirecting.
				 *
				 * @param ctx The current request context used to derive origin and query params.
				 * @returns A redirect to the external identity provider authorization endpoint.
				 */
				action(ctx) {
					let provider = createProvider({
						auth: {
							clientId: getEnv("CLIENT_ID"),
							clientSecret: getEnv("CLIENT_SECRET"),
						},
						redirectUri: new URL(routes.auth.callback.href(), ctx.request.url).toString(),
					});
					let returnTo = ctx.url.searchParams.get("next");
					return startExternalAuth(provider, ctx, { returnTo });
				},
			},
		},

		logout: {
			middleware: [],
			actions: {
				/**
				 * Renders the logout confirmation screen before session termination.
				 *
				 * @returns The logout HTML view for user confirmation.
				 */
				async index() {
					return view(LogoutView, {});
				},

				/**
				 * Ends local authentication and redirects through the provider logout endpoint.
				 *
				 * Non-obvious behavior: `id_token_hint` is sent only when available, while
				 * `Clear-Site-Data` is always included to remove browser-side residual state.
				 *
				 * @param ctx The current request context used to build absolute return URLs.
				 * @returns A 303 redirect response to the provider logout endpoint.
				 */
				action(ctx) {
					let idToken = getIdToken();
					let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
					if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
					logoutUrl.searchParams.set(
						"post_logout_redirect_uri",
						new URL(routes.feed.href(), ctx.request.url).toString(),
					);

					let response = redirect(logoutUrl, {
						status: redirect.Status.SeeOther,
						headers: {
							"Clear-Site-Data": '"*"',
						},
					});

					logout();

					return response;
				},
			},
		},

		callback: {
			middleware: [],
			/**
			 * Completes the OAuth callback handshake and establishes the local user session.
			 *
			 * Contract: validates provider transaction, callback params, and PKCE state before
			 * exchanging tokens; always clears `__auth` when transaction validation reaches exchange.
			 *
			 * Non-obvious behavior: `transaction.returnTo` is honored only for absolute-path values
			 * to prevent open redirects; all other values fall back to the dashboard.
			 *
			 * @param ctx The callback request context containing URL params and scoped services.
			 * @returns The login view with error details or a 303 redirect after successful sign-in.
			 */
			async handler(ctx) {
				let result: Awaited<ReturnType<typeof exchangeCodeForIdToken>>;
				let session = ctx.get(Session);
				let transaction = session.get("__auth") as OAuthTransaction | null;
				let callbackError = ctx.url.searchParams.get("error");
				if (callbackError) {
					return view(LoginView, {
						error: ctx.url.searchParams.get("error_description") ?? callbackError,
					});
				}
				if (!transaction || transaction.provider !== "sergiodxa") {
					return view(LoginView, { error: "Authentication failed. Missing transaction." });
				}
				let state = ctx.url.searchParams.get("state");
				let code = ctx.url.searchParams.get("code");
				if (!state || !code) {
					session.unset("__auth");
					return view(LoginView, { error: "Authentication failed. Missing callback params." });
				}
				if (state !== transaction.state) {
					session.unset("__auth");
					return view(LoginView, { error: "Authentication failed. Invalid state." });
				}

				try {
					result = await exchangeCodeForIdToken({
						auth: {
							clientId: getEnv("CLIENT_ID"),
							clientSecret: getEnv("CLIENT_SECRET"),
						},
						code,
						codeVerifier: transaction.codeVerifier,
						redirectUri: new URL(routes.auth.callback.href(), ctx.request.url).toString(),
					});
					session.unset("__auth");
				} catch {
					session.unset("__auth");
					return view(LoginView, { error: "Authentication failed. Please try again." });
				}

				let idTokenRaw = result.idToken;
				if (!idTokenRaw) {
					return view(LoginView, { error: "Authentication failed. Missing token response." });
				}

				let idToken = await verifyIdToken(
					idTokenRaw,
					await idTokenVerificationKey,
					getEnv("CLIENT_ID"),
				);
				let user = await User.findOrCreateFromAuthProfile(ctx.get(Database), {
					subjectId: idToken.subject,
					email: idToken.email,
					avatar: idToken.picture,
					username: idToken.username,
					displayName: idToken.name,
				});

				login(user);
				setIdToken(idTokenRaw);

				let returnTo =
					transaction.returnTo && transaction.returnTo.startsWith("/")
						? transaction.returnTo
						: routes.cms.dashboard.href();
				return redirect(returnTo, { status: redirect.Status.SeeOther });
			},
		},
	},
});
