/**
 * Authentication controllers for the blog: guest-only login and logout pages plus the
 * OAuth callback that runs the PKCE authorization-code flow, verifies the returned ID
 * token, and establishes the local user session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { Location } from "@pkg/location";
import { Logger } from "@pkg/logger";
import { inject } from "@pkg/service-container";
import { startExternalAuth } from "remix/auth";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction, createController, type Middleware } from "remix/router";
import { Session } from "remix/session";

import { exchangeCodeForIdToken } from "~/app/auth/services/oauth";
import { verifyIdToken } from "~/app/auth/value-objects/id-token";
import { getIdToken, isAuthenticated, login, logout, setIdToken } from "~/app/http/middleware/auth";
import { getEnv } from "~/app/http/middleware/env";
import { User } from "~/app/repositories/user";
import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";
import { OAuthProviderService } from "~/app/services/oauth-provider";
import { LoginView } from "~/resources/views/auth/login";
import { LogoutView } from "~/resources/views/auth/logout";
import routes from "~/routes/web";

interface OAuthTransaction {
	provider: string;
	state: string;
	codeVerifier: string;
	returnTo?: string;
}

/** Sends visitors that already have a session to the dashboard. */
let guestOnlyMiddleware: Middleware[] = [
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
		/** Renders the login screen where visitors start external authentication. */
		async index(ctx) {
			return ctx.render(LoginView, {});
		},

		/**
		 * Starts a PKCE authorization transaction, carrying the `next` query param through as
		 * the post-login destination.
		 * @returns Redirect to the provider authorization endpoint.
		 */
		action: inject([OAuthProviderService] as const, async (oauthProvider) => {
			let ctx = getContext();
			let provider = await oauthProvider.create(ctx.request.url);
			let returnTo = ctx.url.searchParams.get("next");
			return startExternalAuth(provider, ctx, { returnTo });
		}),
	},
});

/** Logout route controller for confirmation and local session teardown. */
export let logoutController = createController(routes.auth.logout, {
	middleware: guestOnlyMiddleware,
	actions: {
		/** Renders the logout confirmation screen shown before session teardown. */
		async index(ctx) {
			return ctx.render(LogoutView, {});
		},

		/**
		 * Hands off to the provider logout endpoint with an `id_token_hint` so the upstream
		 * session ends too, and clears client state through `Clear-Site-Data`.
		 * @returns 303 redirect to the provider logout endpoint.
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
	 * Requires the stored transaction and a matching `state` before the code exchange, and
	 * clears that transaction on every terminal path so one callback serves one login.
	 * @returns The login view carrying an error, or a 303 redirect once signed in.
	 */
	handler: inject(
		[Database, IdTokenVerificationKeyService, Logger] as const,
		async (db, verificationKey, logger) => {
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

			// Path normalization turns a target such as `/..//evil.com` into the
			// protocol-relative `//evil.com`, which a leading-slash check accepts.
			let returnTo = Location.safe(transaction.returnTo, {
				fallback: routes.cms.dashboard.href(),
			});
			return redirect(returnTo, { status: redirect.Status.SeeOther });
		},
	),
});
