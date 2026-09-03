/**
 * Authentication controller for `/auth`: the POST starts the OIDC authorization-code flow
 * and the GET completes the callback, provisioning everything a first sign-in needs — the
 * billing customer, a team, any trial monitors that address is owed — before it redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IdToken } from "@pkg/auth/id-token";
import type { i18n } from "@pkg/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { AuthError, AuthErrorCode } from "@pkg/auth/auth-error";
import { redirect } from "@pkg/http/response";
import { Location } from "@pkg/location";
import { isFailure, wrap } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { m, minBs, p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { fontSize, textAlign, textDecoration } from "@pkg/u/typography";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";
import { Session } from "remix/session";

import type { TrialAttribution } from "~/app/http/middleware/attribution";

import { relyingParty } from "~/app/auth/relying-party";
import Customer from "~/app/data/customer";
import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { language as languageCookie, returnTo } from "~/app/http/cookies";
import { TRIAL_ATTRIBUTION } from "~/app/http/middleware/attribution";
import { attributionProperties, trackAccountCreated } from "~/app/services/funnel-events";
import { convertTrialWatches } from "~/app/services/trial-conversion";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The slice of `remix/router`'s `RequestContext` the sign-in failure page renders from. */
interface AuthErrorContext {
	render: Renderer<RemixNode>;
	i18next: i18n;
}

/**
 * The team this sign-in lands in: their own membership first, then a domain
 * join, then a fresh personal team — because a domain-joined team belongs to
 * the employer, and only an owned team should receive their anonymous history.
 */
async function resolveTeam(db: Database, idToken: IdToken) {
	let teams = await Team.listBySubjectId(db, idToken.subject);

	let [first] = teams;
	if (first) return teams.find((team) => team.owner_id === idToken.subject) ?? first;

	let joined = await Team.joinByDomain(db, idToken);
	if (joined) return joined;

	/**
	 * Emits `account_created` here because reaching this branch means a team was
	 * just created for a brand-new account; `convertTrialWatches` emits its own
	 * for the free-page path, so summing the two counts every new account once.
	 */
	let created = await Team.createTeam(db, idToken);

	trackAccountCreated(getContext().logger, {
		ownerId: idToken.subject,
		fromTrial: false,
		watchCount: 0,
		emailsSent: 0,
		...attributionProperties(),
	});

	return created;
}

/**
 * Seeds the `language` cookie from the subject's stored preference so the
 * page this redirects to loads already in their language — the cookie is the
 * only signal a normal request's language resolution reads before its database fallback.
 *
 * @returns Headers carrying the cookie, or undefined when there is no stored preference.
 */
async function languageHeaders(db: Database, subjectId: string): Promise<Headers | undefined> {
	let preferences = await UserPreferences.findBySubjectId(db, subjectId);
	if (!preferences?.preferred_language) return undefined;

	let headers = new Headers();
	headers.append("Set-Cookie", await languageCookie.serialize(preferences.preferred_language));

	return headers;
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
		/**
		 * POST /auth — starts the OIDC authorization-code flow, moving any pending `returnTo`
		 * from its cookie into the session-backed login transaction the callback reads.
		 */
		async action(ctx) {
			let cookieReturnTo = await returnTo.parse(ctx.request.headers.get("Cookie"));
			let response = await relyingParty(ctx.url).authorize(ctx, { returnTo: cookieReturnTo });
			response.headers.append("Set-Cookie", await returnTo.serialize("", { maxAge: 0 }));
			return response;
		},

		/** GET /auth — completes the OIDC callback and establishes the session. */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let finished = await wrap(() => relyingParty(ctx.url).callback(ctx));

			if (isFailure(finished)) {
				let error = finished.error;

				ctx.logger.error("auth.callback_failed", {
					error: error.message,
					stack: error.stack,
					code: error instanceof AuthError ? error.code : undefined,
					oauthError: ctx.url.searchParams.get("error"),
					oauthErrorDescription: ctx.url.searchParams.get("error_description"),
				});

				if (AuthError.is(error, AuthErrorCode.MissingIdToken)) {
					return authError(ctx, ctx.i18next.t("auth.error.missingIdToken"));
				}

				return authError(ctx, ctx.i18next.t("auth.error.signInFailedGeneric"));
			}

			let grant = finished.data;
			let idToken = grant.idToken;

			let customer = await Customer.provision(ctx.billing, idToken);

			/**
			 * A sign-in completes whether or not billing answered: the customer is provisioned
			 * again on the next one, and the daily repair sweep reaches an owner who paid in the
			 * meantime, so a platform outage costs a login nothing.
			 */
			if (isFailure(customer)) {
				ctx.logger.error("auth.customer_provision_failed", {
					code: customer.error.code,
					providerCode: customer.error.providerCode,
					connection: customer.error.connection,
					subject: idToken.subject,
				});
			}

			let team = await resolveTeam(db, idToken);

			/**
			 * Runs after the team exists and before the redirect, so its monitors land in
			 * the team that redirect will already show. The service always resolves
			 * normally, so sign-in completes regardless of the conversion outcome.
			 */
			await convertTrialWatches(db, {
				email: idToken.email ?? "",
				teamId: team.id,
				authorId: idToken.subject,
				/**
				 * Read here because this request is the last one holding the anonymous
				 * session `attribution` was captured into. Left in the session afterward,
				 * so a sign-in racing in a second tab still finds its own attribution intact.
				 */
				attribution: ctx.get(Session)?.get(TRIAL_ATTRIBUTION) as TrialAttribution | undefined,
			});

			let target = Location.safe(grant.returnTo, { fallback: routes.app.index.href() });
			return redirect(target, {
				status: redirect.Status.SeeOther,
				headers: await languageHeaders(db, idToken.subject),
			});
		}),
	},
});
