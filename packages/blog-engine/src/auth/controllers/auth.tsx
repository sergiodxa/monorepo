/**
 * Auth controllers for the admin panel's OIDC login/logout flow: the sign-in and
 * sign-out screens, the flow start (PKCE), and the callback that establishes the
 * local session. Includes `safeNext`, the same-origin redirect guard for `next`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { finishExternalAuth, startExternalAuth } from "remix/auth";
import { Database } from "remix/data-table";
import { createAction, createController } from "remix/fetch-router";

import routes from "../../routes";
import * as s from "../../shared/components/styles";
import { User } from "../../users/models/user";
import { getIdToken, login as signIn, logout as signOut, setIdToken } from "../middleware/auth";
import { createProvider, resolveEndSessionEndpoint, toAuthProfile } from "../oidc";

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
 * Validates a post-login `next`/`returnTo` target so it can only be a same-origin
 * path. Rejects protocol-relative (`//host`) and backslash (`/\host`) tricks and any
 * absolute URL to another origin — an open-redirect guard for the auth flow.
 * @param value - The candidate redirect target from the query or session.
 * @param request - The current request, used to resolve the origin.
 * @returns The normalized same-origin path, or `undefined` when unsafe.
 * @example
 * safeNext("/cms/posts", request); // "/cms/posts"
 * safeNext("//evil.example", request); // undefined
 */
export function safeNext(value: string | null | undefined, request: Request): string | undefined {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
		return undefined;
	}
	try {
		let base = new URL(request.url);
		let resolved = new URL(value, base);
		if (resolved.origin !== base.origin) return undefined;
		return resolved.pathname + resolved.search + resolved.hash;
	} catch {
		return undefined;
	}
}

/**
 * Builds the absolute `/auth/callback` URL for this request's host (the OIDC
 * redirect URI), derived per request so it works on any host or subdomain.
 * @param request - The current request.
 * @returns The absolute callback URL.
 */
function callbackUri(request: Request): string {
	return new URL(routes.auth.callback.href(), request.url).toString();
}

/** `/auth/login` — renders the sign-in screen (GET) and starts the flow (POST). */
export const login = createController(routes.auth.login, {
	actions: {
		async index(ctx) {
			let url = new URL(ctx.request.url);
			let next = url.searchParams.get("next");
			let errorParam = url.searchParams.get("error");
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

		async action(ctx) {
			let provider = createProvider(ctx.oidc, callbackUri(ctx.request));
			let next = safeNext(new URL(ctx.request.url).searchParams.get("next"), ctx.request);
			// startExternalAuth stores the PKCE/state transaction in the session.
			return startExternalAuth(provider, ctx, { returnTo: next });
		},
	},
});

/** GET /auth/callback — completes the flow and establishes the local session. */
export const callback = createAction(
	routes.auth.callback,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let log = ctx.logger.loader("/auth/callback");
		let loginUrl = routes.auth.login.index.href();
		let provider = createProvider(ctx.oidc, callbackUri(ctx.request));

		try {
			let { result, returnTo } = await finishExternalAuth(provider, ctx);
			let user = await User.findOrCreateFromAuthProfile(db, toAuthProfile(result.profile), {
				admins: ctx.oidc.admins,
				bootstrapFirstAdmin: ctx.oidc.bootstrapFirstAdmin,
			});
			signIn(user);
			if (typeof result.tokens.idToken === "string") setIdToken(result.tokens.idToken);
			log.info("Login completed", { userId: user.id });
			let dest = safeNext(returnTo, ctx.request) ?? routes.cms.dashboard.href();
			return redirect(dest, { status: redirect.Status.SeeOther });
		} catch (error) {
			log.error("Login failed", { error: String(error) });
			return redirect(`${loginUrl}?error=authentication_failed`, {
				status: redirect.Status.SeeOther,
			});
		}
	}),
);

/** `/auth/logout` — sign-out confirmation (GET) and session teardown (POST). */
export const logout = createController(routes.auth.logout, {
	actions: {
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

		async action(ctx) {
			let idToken = getIdToken();
			let origin = new URL(ctx.request.url).origin;
			let endSession = await resolveEndSessionEndpoint(ctx.oidc);
			signOut();

			if (endSession) {
				let logoutUrl = new URL(endSession);
				if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
				logoutUrl.searchParams.set("post_logout_redirect_uri", `${origin}/`);
				return redirect(logoutUrl.toString(), {
					status: redirect.Status.SeeOther,
					headers: { "Clear-Site-Data": '"*"' },
				});
			}
			return redirect("/", { status: redirect.Status.SeeOther });
		},
	},
});
