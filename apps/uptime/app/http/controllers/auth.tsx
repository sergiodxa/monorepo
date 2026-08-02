/**
 * Authentication controller for `/auth`. The `action` (POST) starts the OIDC
 * authorization-code flow against auth.sergiodxa.com; the `index` (GET) completes the
 * callback, verifies the returned ID token, provisions the Polar customer, resolves
 * the subject's team (existing membership, then domain join, then a new personal
 * team), turns any trial targets that address is still owed into real monitors in that
 * team, writes the session, and redirects to the saved `returnTo` path or `/app`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@pkg/i18n";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";
import { border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { m, minBs, p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { fontSize, textAlign, textDecoration } from "@pkg/u/typography";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { finishExternalAuth, startExternalAuth } from "remix/auth";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type IdToken from "~/app/auth/value-objects/id-token";

import { createAuthProvider } from "~/app/auth/services/oauth";
import { verifyIdToken } from "~/app/auth/value-objects/id-token";
import Customer from "~/app/data/customer";
import Team from "~/app/data/team";
import { returnTo, safeReturnTo } from "~/app/http/cookies";
import { login, setIdToken } from "~/app/http/middleware/auth";
import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";
import { convertTrialWatches } from "~/app/services/trial-conversion";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Builds the OIDC provider from the app's registered client credentials. */
function provider(ctx: { request: Request }) {
	return createAuthProvider({
		clientId: env.CLIENT_ID,
		clientSecret: env.CLIENT_SECRET,
		redirectUri: new URL(routes.auth.index.href(), ctx.request.url).toString(),
	});
}

/**
 * Narrowed shape of `remix/fetch-router`'s `RequestContext` this helper
 * actually reads. `i18next` is declared here only to keep this file's
 * dependency surface explicit — the global `i18n` middleware (see
 * `bootstrap/app.tsx`) already populates `ctx.i18next` for every action this
 * controller's `createController` call handles.
 */
interface AuthErrorContext {
	render: Renderer<RemixNode>;
	i18next: i18n;
}

/**
 * The team this sign-in lands in: an existing membership, then a domain join, then a fresh
 * personal team.
 *
 * Returns the team rather than only ensuring one exists, because the trial conversion that
 * runs next has to be told where to create monitors. A subject who belongs to several is
 * given the one they own, and that preference is the point: a domain-joined team is their
 * employer's, and the URLs someone probed anonymously on a public page are not something to
 * publish to their colleagues on their behalf. Falling back to the first membership when
 * they own none keeps the offer working for a subject whose only team is a shared one, which
 * is the team they would have been reading the dashboard of anyway.
 */
async function resolveTeam(db: Database, idToken: IdToken) {
	let teams = await Team.listBySubjectId(db, idToken.subject);

	let [first] = teams;
	if (first) return teams.find((team) => team.owner_id === idToken.subject) ?? first;

	return (await Team.joinByDomain(db, idToken)) ?? (await Team.createTeam(db, idToken));
}

/** Renders the sign-in failure page, showing `message` verbatim as supplied by the caller. */
function authError(ctx: AuthErrorContext, message: string) {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("auth.error.signInFailedTitle")}>
			<main mix={[flex(), flexCol(), minBs("100vh")]}>
				<div
					mix={[
						flex(),
						flexCol(),
						items("center"),
						textAlign("center"),
						gap("12px"),
						p("64px", "32px"),
						border({ color: "neutral", width: 1, style: "dashed" }),
						rounded("12px"),
					]}
				>
					<h1 mix={[m("0")]}>{ctx.i18next.t("auth.error.signInFailedTitle")}</h1>
					<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>{message}</p>
					<a
						href={routes.home.href()}
						mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
					>
						{ctx.i18next.t("errors.backHome")}
					</a>
				</div>
			</main>
		</DocumentLayout>,
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
			/** The value now lives in the session-backed OAuth transaction; drop the cookie. */
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
					return authError(ctx, ctx.i18next.t("auth.error.signInFailedGeneric"));
				}

				let idTokenRaw = finished.result.tokens.idToken;
				if (!idTokenRaw) return authError(ctx, ctx.i18next.t("auth.error.missingIdToken"));

				let idToken = await verifyIdToken(idTokenRaw, await verificationKey.value, env.CLIENT_ID);

				await Customer.findOrCreate(polar, idToken);

				let team = await resolveTeam(db, idToken);

				/**
				 * After the team exists and before the session is written, because it needs
				 * somewhere to put the monitors it creates and the person must find them already
				 * there when the redirect lands them on the dashboard. It never throws — see the
				 * service — so sign-in cannot fail on it.
				 */
				await convertTrialWatches(db, {
					email: idToken.email,
					teamId: team.id,
					authorId: idToken.subject,
				});

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
