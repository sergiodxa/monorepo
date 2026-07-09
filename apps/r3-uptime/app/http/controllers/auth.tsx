/**
 * Authentication controller for `/auth`. The `action` (POST) starts the OIDC
 * authorization-code flow against auth.sergiodxa.com; the `index` (GET) completes the
 * callback, verifies the returned ID token, provisions the Polar customer, resolves
 * the subject's team (existing membership, then domain join, then a new personal
 * team), writes the session, and redirects to the saved `returnTo` path or `/app`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { finishExternalAuth, startExternalAuth } from "remix/auth";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { createAuthProvider } from "~/app/auth/services/oauth";
import { verifyIdToken } from "~/app/auth/value-objects/id-token";
import Customer from "~/app/data/customer";
import Team from "~/app/data/team";
import { returnTo, safeReturnTo } from "~/app/http/cookies";
import { login, setIdToken } from "~/app/http/middleware/auth";
import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";
import DocumentLayout from "~/resources/layouts/document";
import AuthErrorView from "~/resources/views/auth-error";
import routes from "~/routes/web";

/** Builds the OIDC provider from the app's registered client credentials. */
function provider(ctx: { request: Request }) {
	return createAuthProvider({
		clientId: env.CLIENT_ID,
		clientSecret: env.CLIENT_SECRET,
		redirectUri: new URL(routes.auth.index.href(), ctx.request.url).toString(),
	});
}

/** Renders the sign-in failure page. */
function authError(ctx: { render: Renderer<RemixNode> }, message: string) {
	let renderDocument = DocumentLayout();
	return ctx.render(
		renderDocument({ title: "Sign-in failed", children: <AuthErrorView message={message} /> }),
		{ status: 400 },
	);
}

export default createController(routes.auth, {
	actions: {
		/** POST /auth — starts the OIDC authorization-code flow. */
		async action(ctx) {
			let cookieReturnTo = await returnTo.parse(ctx.request.headers.get("Cookie"));
			let response = await startExternalAuth(provider(ctx), ctx, {
				returnTo: cookieReturnTo ?? undefined,
			});
			// The value now lives in the session-backed OAuth transaction; drop the cookie.
			response.headers.append("Set-Cookie", await returnTo.serialize("", { maxAge: 0 }));
			return response;
		},

		/** GET /auth — completes the OIDC callback and establishes the session. */
		index: inject(
			[Database, PolarClient, IdTokenVerificationKeyService] as const,
			async (db, polar, verificationKey) => {
				let ctx = getContext();
				let finished: Awaited<ReturnType<typeof finishExternalAuth>>;
				try {
					finished = await finishExternalAuth(provider(ctx), ctx);
				} catch (error) {
					ctx.logger.error("auth.callback_failed", {
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
						oauthError: ctx.url.searchParams.get("error"),
						oauthErrorDescription: ctx.url.searchParams.get("error_description"),
					});
					return authError(ctx, "The sign-in attempt could not be completed. Please try again.");
				}

				let idTokenRaw = finished.result.tokens.idToken;
				if (!idTokenRaw) return authError(ctx, "The identity provider did not return an ID token.");

				let idToken = await verifyIdToken(idTokenRaw, await verificationKey.value, env.CLIENT_ID);

				await Customer.findOrCreate(polar, idToken);

				let teams = await Team.listBySubjectId(db, idToken.subject);
				if (teams.length === 0) {
					let joined = await Team.joinByDomain(db, idToken);
					if (!joined) await Team.createTeam(db, idToken);
				}

				login({
					id: idToken.subject,
					name: idToken.name,
					email: idToken.email,
					avatar: idToken.picture,
				});
				setIdToken(idTokenRaw);

				return redirect(safeReturnTo(finished.returnTo, routes.app.index.href()), {
					status: redirect.Status.SeeOther,
				});
			},
		),
	},
});
