import { redirect } from "@pkg/http/response";
import { Logger } from "@pkg/logger";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { startExternalAuth } from "remix/auth";
import { Database } from "remix/data-table";
import { createAction, createController, type Middleware } from "remix/fetch-router";
import { Session } from "remix/session";

import { createProvider, exchangeCodeForIdToken } from "~/app/auth/services/oauth";
import { verifyIdToken } from "~/app/auth/value-objects/id-token";
import { getIdToken, isAuthenticated, login, logout, setIdToken } from "~/app/http/middleware/auth";
import { getEnv } from "~/app/http/middleware/env";
import { User } from "~/app/repositories/user";
import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";
import { LoginView } from "~/resources/views/auth/login";
import { LogoutView } from "~/resources/views/auth/logout";
import routes from "~/routes/web";

interface OAuthTransaction {
	provider: string;
	state: string;
	codeVerifier: string;
	returnTo?: string;
}

/**
 * Orchestrates the authentication flow for login, logout, and OAuth callback routes.
 * Keeps login/logout pages guest-only and completes a full PKCE transaction on callback.
 *
 * @example
 * GET /auth/login
 * @example
 * GET /auth/callback?code=...&state=...
 */
let guestOnlyMiddleware: Middleware[] = [
	/**
	 * Guards guest-only auth pages by short-circuiting authenticated requests.
	 * @returns A redirect response when a session already exists.
	 */
	async (_ctx, next) => {
		if (isAuthenticated()) {
			return redirect(routes.cms.dashboard.href(), { status: redirect.Status.SeeOther });
		}

		return next();
	},
];

/** Login route controller for rendering and starting the OAuth flow. */
export let loginController = createController(routes.auth.login, {
	middleware: guestOnlyMiddleware,
	actions: {
		/**
		 * Renders the login screen where users can start external authentication.
		 * @returns The login HTML view without mutating session state.
		 */
		async index(ctx) {
			return ctx.render(LoginView, {});
		},

		/**
		 * Starts an OAuth authorization transaction with PKCE and optional post-login redirect.
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
});

/** Logout route controller for confirmation and local session teardown. */
export let logoutController = createController(routes.auth.logout, {
	middleware: guestOnlyMiddleware,
	actions: {
		/**
		 * Renders the logout confirmation screen before session termination.
		 * @returns The logout HTML view for user confirmation.
		 */
		async index(ctx) {
			return ctx.render(LogoutView, {});
		},

		/**
		 * Ends local authentication and redirects through the provider logout endpoint.
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
});

/** OAuth callback action that completes login and establishes the local session. */
export let callbackAction = createAction(routes.auth.callback, {
	middleware: [],
	/**
	 * Completes the OAuth callback handshake and establishes the local user session.
	 * @param ctx The callback request context containing URL params and scoped services.
	 * @returns The login view with error details or a 303 redirect after successful sign-in.
	 */
	handler: inject([Database, IdTokenVerificationKeyService, Logger] as const, async (db, verificationKey, logger) => {
			let ctx = getContext();
			let result: Awaited<ReturnType<typeof exchangeCodeForIdToken>>;
			let session = ctx.get(Session);
			let transaction = session.get("__auth") as OAuthTransaction | null;
			logger.info("auth.callback.started", {
				pathname: ctx.url.pathname,
				hasTransaction: Boolean(transaction),
			});
			let callbackError = ctx.url.searchParams.get("error");
			if (callbackError) {
				logger.error("auth.callback.provider-error", {
					error: callbackError,
					description: ctx.url.searchParams.get("error_description") ?? null,
				});
				return ctx.render(LoginView, {
					error: ctx.url.searchParams.get("error_description") ?? callbackError,
				});
			}
			if (!transaction || transaction.provider !== "sergiodxa") {
				logger.error("auth.callback.missing-transaction", {
					provider: transaction?.provider ?? null,
				});
				return ctx.render(LoginView, { error: "Authentication failed. Missing transaction." });
			}
			let state = ctx.url.searchParams.get("state");
			let code = ctx.url.searchParams.get("code");
			if (!state || !code) {
				session.unset("__auth");
				logger.error("auth.callback.missing-params", {
					hasState: Boolean(state),
					hasCode: Boolean(code),
				});
				return ctx.render(LoginView, { error: "Authentication failed. Missing callback params." });
			}
			if (state !== transaction.state) {
				session.unset("__auth");
				logger.error("auth.callback.invalid-state", {
					expectedState: transaction.state,
					receivedState: state,
				});
				return ctx.render(LoginView, { error: "Authentication failed. Invalid state." });
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
				logger.error("auth.callback.exchange-failed", {
					provider: transaction.provider,
				});
				return ctx.render(LoginView, { error: "Authentication failed. Please try again." });
			}

			let idTokenRaw = result.idToken;
			if (!idTokenRaw) {
				logger.error("auth.callback.missing-id-token", {
					provider: transaction.provider,
				});
				return ctx.render(LoginView, { error: "Authentication failed. Missing token response." });
			}

			let idToken = await verifyIdToken(
				idTokenRaw,
				await verificationKey.value,
				getEnv("CLIENT_ID"),
			);
			let user = await User.findOrCreateFromAuthProfile(db, {
				subjectId: idToken.subject,
				email: idToken.email,
				avatar: idToken.picture,
				username: idToken.username,
				displayName: idToken.name,
			});

			login(user);
			setIdToken(idTokenRaw);
			logger.info("auth.callback.completed", {
				userId: user.id,
				username: user.username,
			});

			let returnTo =
				transaction.returnTo && transaction.returnTo.startsWith("/")
					? transaction.returnTo
					: routes.cms.dashboard.href();
			return redirect(returnTo, { status: redirect.Status.SeeOther });
		}),
});
