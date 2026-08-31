/**
 * Authentication controllers for the blog: guest-only login and logout pages plus the
 * OIDC callback that finishes the authorization-code flow, reconciles the provider's
 * profile with the local account, and establishes the signed-in session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthError, AuthErrorCode } from "@pkg/auth/auth-error";
import { redirect } from "@pkg/http/response";
import { Location } from "@pkg/location";
import { Logger } from "@pkg/logger";
import { isFailure, wrap } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction, createController, type Middleware } from "remix/router";

import { relyingParty } from "~/app/auth/relying-party";
import { isAuthenticated, login, logout } from "~/app/http/middleware/auth";
import { User } from "~/app/repositories/user";
import { LoginView } from "~/resources/views/auth/login";
import { LogoutView } from "~/resources/views/auth/logout";
import routes from "~/routes/web";

/** What the login screen says about a login that could not be completed. */
const GENERIC_FAILURE = "Authentication failed. Please try again.";

/**
 * What the login screen says about each way the provider's answer can be refused, so a
 * visitor reads which step failed instead of one message for every cause.
 */
const FAILURE_MESSAGES: Partial<Record<AuthErrorCode, string>> = {
	[AuthErrorCode.MissingTransaction]: "Authentication failed. Missing transaction.",
	[AuthErrorCode.StateMismatch]: "Authentication failed. Invalid state.",
	[AuthErrorCode.MissingCode]: "Authentication failed. Missing callback params.",
	[AuthErrorCode.MissingIdToken]: "Authentication failed. Missing token response.",
};

/**
 * Turns a refused login into the sentence the login screen shows. A refusal the
 * provider explained is reported in its own words, since it names the reason the
 * account could not be used.
 *
 * @param error What the callback threw.
 * @returns The message rendered with the login form.
 */
function describeFailure(error: Error): string {
	if (!(error instanceof AuthError)) return GENERIC_FAILURE;

	if (error.code === AuthErrorCode.AuthorizationFailed) {
		return error.providerErrorDescription ?? error.providerError ?? GENERIC_FAILURE;
	}

	return FAILURE_MESSAGES[error.code] ?? GENERIC_FAILURE;
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
		 * Starts an authorization transaction, carrying the `next` query param through as
		 * the post-login destination; a destination naming another origin is dropped for
		 * the dashboard.
		 * @returns Redirect to the provider authorization endpoint.
		 */
		async action(ctx) {
			return relyingParty(ctx.url).authorize(ctx, {
				returnTo: ctx.url.searchParams.get("next"),
			});
		},
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
		async action(ctx) {
			let endpoint = await relyingParty(ctx.url).endSession(ctx, {
				returnTo: routes.feed.href(),
				redirect: false,
			});

			logout();

			return redirect(endpoint, {
				status: redirect.Status.SeeOther,
				headers: {
					"Clear-Site-Data": '"*"',
				},
			});
		},
	},
});

/** OAuth callback action that completes login and establishes the local session. */
export let callbackAction = createAction(routes.auth.callback, {
	middleware: [],
	/**
	 * Correlates the provider's answer with the login that asked for it and verifies the
	 * ID token before any claim is believed, then reconciles the subject with the local
	 * account so the session names a row of this app's own.
	 * @returns The login view carrying an error, or a 303 redirect once signed in.
	 */
	handler: inject([Database, Logger] as const, async (db, logger) => {
		let ctx = getContext();
		logger.info("auth.callback.started", { pathname: ctx.url.pathname });

		let result = await wrap(() => relyingParty(ctx.url).callback(ctx));

		if (isFailure(result)) {
			logger.error("auth.callback.failed", {
				code: result.error instanceof AuthError ? result.error.code : null,
				providerError: result.error instanceof AuthError ? result.error.providerError : null,
			});

			return ctx.render(LoginView, { error: describeFailure(result.error) });
		}

		let grant = result.data;
		let user = await User.findOrCreateFromAuthProfile(db, {
			subjectId: grant.subject,
			...grant.profile,
		});

		login(user);
		logger.info("auth.callback.completed", {
			userId: user.id,
			username: user.username,
		});

		let returnTo = Location.safe(grant.returnTo, {
			fallback: routes.cms.dashboard.href(),
		});
		return redirect(returnTo, { status: redirect.Status.SeeOther });
	}),
});
