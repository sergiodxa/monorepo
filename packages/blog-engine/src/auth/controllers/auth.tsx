/**
 * Auth controllers for the admin panel's OIDC login/logout flow: the sign-in and
 * sign-out screens, the flow start, and the callback that turns a verified login
 * into a local session. Includes `safeNext`, the same-origin guard for `next`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { Location } from "@pkg/location";
import { isFailure, wrap } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction, createController } from "remix/router";

import routes from "../../routes";
import * as s from "../../shared/components/styles";
import { User } from "../../users/models/user";
import { login as signIn, logout as signOut } from "../middleware/auth";
import { toAuthProfile } from "../oidc";

/**
 * Standalone centered page shell for the auth screens (login/logout), with an
 * optional error banner.
 * @param handle - Component handle exposing `title`, optional `error`, and `children`.
 * @returns A render function producing the auth page document.
 */
function AuthPage(handle: Handle<{ title: string; error?: string; children: RemixNode }>) {
	return () => {
		let { title, error, children } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
				</head>
				<body mix={[s.authBody]}>
					{error && <p mix={[s.errorText]}>{error}</p>}
					{children}
				</body>
			</html>
		);
	};
}

/**
 * Narrows a post-login `next`/`returnTo` target to a path this app serves, keeping its
 * query string and hash. Yields `undefined` for an unusable target, leaving the caller
 * to choose where the visitor lands.
 * @param value - The candidate redirect target from the query or session.
 * @returns The normalized same-origin path, or `undefined`.
 * @example
 * safeNext("/cms/posts?tab=drafts"); // "/cms/posts?tab=drafts"
 * safeNext("//evil.example"); // undefined
 */
export function safeNext(value: string | null | undefined): string | undefined {
	if (!value || !Location.isSafe(value)) return undefined;
	return Location.from(value).toString();
}

/** `/auth/login` — renders the sign-in screen (GET) and starts the flow (POST). */
export const login = createController(routes.auth.login, {
	actions: {
		/** GET — the sign-in screen, carrying any usable `next` into its form action. */
		async index(ctx) {
			let next = safeNext(ctx.url.searchParams.get("next"));
			let errorParam = ctx.url.searchParams.get("error");
			let formAction =
				routes.auth.login.action.href() + (next ? `?next=${encodeURIComponent(next)}` : "");
			return ctx.render(
				<AuthPage title="Sign in" error={errorParam ?? undefined}>
					<h1>Sign in</h1>
					<form method="post" action={formAction}>
						<button mix={[s.button]} type="submit">
							Continue
						</button>
					</form>
				</AuthPage>,
			);
		},

		/** POST — starts the flow, remembering only a `next` this blog itself serves. */
		async action(ctx) {
			return ctx.relyingParty.authorize(ctx, {
				returnTo: safeNext(ctx.url.searchParams.get("next")),
			});
		},
	},
});

/** GET /auth/callback — completes the flow and establishes the local session. */
export const callback = createAction(
	routes.auth.callback,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let log = ctx.logger.loader("/auth/callback");

		let completed = await wrap(async () => {
			let grant = await ctx.relyingParty.callback(ctx);
			let user = await User.findOrCreateFromAuthProfile(
				db,
				toAuthProfile(grant.profile, grant.subject),
				{ admins: ctx.oidc.admins, bootstrapFirstAdmin: ctx.oidc.bootstrapFirstAdmin },
			);
			signIn(user);
			return { userId: user.id, next: grant.returnTo };
		});

		if (isFailure(completed)) {
			log.error("Login failed", { error: String(completed.error) });
			return redirect(`${routes.auth.login.index.href()}?error=authentication_failed`, {
				status: redirect.Status.SeeOther,
			});
		}

		log.info("Login completed", { userId: completed.data.userId });
		return redirect(completed.data.next, { status: redirect.Status.SeeOther });
	}),
);

/** `/auth/logout` — sign-out confirmation (GET) and session teardown (POST). */
export const logout = createController(routes.auth.logout, {
	actions: {
		/** GET — the sign-out confirmation, which posts to end the session. */
		async index(ctx) {
			return ctx.render(
				<AuthPage title="Sign out">
					<h1>Sign out</h1>
					<form method="post" action={routes.auth.logout.action.href()}>
						<button mix={[s.button]} type="submit">
							Sign out
						</button>
					</form>
				</AuthPage>,
			);
		},

		/**
		 * Reads the end-session URL before dropping the local session, so the request
		 * carries the `id_token_hint` that ends the provider's session too, and lands
		 * the visitor on the blog's home page when the provider publishes no endpoint.
		 */
		async action(ctx) {
			let endSession = await wrap(() =>
				ctx.relyingParty.endSession(ctx, {
					returnTo: routes.feed.href(),
					redirect: false,
				}),
			);
			signOut();

			if (isFailure(endSession)) {
				ctx.logger.loader("/auth/logout").error("Provider sign-out skipped", {
					error: String(endSession.error),
				});
				return redirect(routes.feed.href(), { status: redirect.Status.SeeOther });
			}

			return redirect(endSession.data.toString(), {
				status: redirect.Status.SeeOther,
				headers: { "Clear-Site-Data": '"*"' },
			});
		},
	},
});
