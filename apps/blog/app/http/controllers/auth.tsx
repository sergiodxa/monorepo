/**
 * Authentication controllers for the blog: the guest-only login page, the logout
 * confirmation and sign-out, and the OIDC callback that finishes the authorization-code
 * flow, reconciles the provider's profile with the local account, and opens the session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthError, AuthErrorCode } from "@sdxc/auth/auth-error";
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { Location } from "@sdxc/location";
import { isFailure, wrap } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
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
 * Tells the browser to drop every other copy of this origin's state, so a shared
 * machine keeps nothing readable behind after a sign-out.
 */
const LOGOUT_HEADERS = { "Clear-Site-Data": '"*"' };

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
			return relyingParty(ctx.url).authorize(contextOf(ctx), {
				returnTo: ctx.url.searchParams.get("next"),
			});
		},
	},
});

/**
 * Answers a sign-out that ends here, sending the reader to the feed with the client
 * state cleared, which is where a person who is already signed out belongs.
 *
 * @returns 303 redirect to the feed.
 */
function signedOut(): Response {
	return redirect(routes.feed.href(), {
		status: redirect.Status.SeeOther,
		headers: LOGOUT_HEADERS,
	});
}

/** Logout route controller for confirmation and local session teardown. */
export let logoutController = createController(routes.auth.logout, {
	actions: {
		/**
		 * Renders the logout confirmation screen shown before session teardown. A reader
		 * carrying no session reads the feed instead: there is nothing to confirm, and a
		 * login prompt would answer the opposite of what they asked for.
		 * @returns The confirmation page, or a 303 redirect to the feed.
		 */
		async index(ctx) {
			if (!isAuthenticated()) {
				return redirect(routes.feed.href(), { status: redirect.Status.SeeOther });
			}

			return ctx.render(LogoutView, {});
		},

		/**
		 * Ends the session on both sides: the provider is handed the `id_token_hint` that
		 * names its own session, and this app's session is destroyed whatever the provider
		 * answers, so a handoff that cannot be built still signs the person out here. A
		 * request already carrying no session is answered the same way, which keeps the
		 * sign-out click in a tab left open overnight terminal.
		 * @returns 303 redirect to the provider logout endpoint, or to the feed.
		 */
		async action(ctx) {
			if (!isAuthenticated()) {
				logout();
				return signedOut();
			}

			let ended = await wrap(() =>
				relyingParty(ctx.url).endSession(contextOf(ctx), {
					returnTo: routes.feed.href(),
					redirect: false,
				}),
			);

			logout();

			if (isFailure(ended)) return signedOut();

			return redirect(ended.data, {
				status: redirect.Status.SeeOther,
				headers: LOGOUT_HEADERS,
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
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let result = await wrap(() => relyingParty(ctx.url).callback(contextOf(ctx)));

		if (isFailure(result)) {
			ctx.log.warn("auth.callback_failed", {
				code: result.error instanceof AuthError ? result.error.code : null,
				provider_error: result.error instanceof AuthError ? result.error.providerError : null,
			});

			return ctx.render(LoginView, { error: describeFailure(result.error) });
		}

		let grant = result.data;
		let user = await User.findOrCreateFromAuthProfile(db, {
			subjectId: grant.subject,
			...grant.profile,
		});

		login(user);
		ctx.log.set({ user: { id: user.id, username: user.username } }).note("auth.callback_completed");

		let returnTo = Location.safe(grant.returnTo, {
			fallback: routes.cms.dashboard.href(),
		});
		return redirect(returnTo, { status: redirect.Status.SeeOther });
	}),
});
