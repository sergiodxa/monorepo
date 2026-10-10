/**
 * Authentication controller for `/auth`: the POST starts the OIDC authorization-code flow
 * and the GET completes the callback, provisioning everything a first sign-in needs — the
 * billing customer, a team, any trial monitors that address is owed — before it redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Touch } from "@sdxc/attribution";
import type { IdToken } from "@sdxc/auth/id-token";
import type { I18n } from "@sdxc/i18n";
import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";

import { AuthError, AuthErrorCode } from "@sdxc/auth/auth-error";
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { Location } from "@sdxc/location";
import { currentLog } from "@sdxc/logger";
import { isFailure, unwrap, wrap } from "@sdxc/result";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexCol, gap, items } from "@sdxc/u/layout";
import { m, minBs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { fontSize, textAlign, textDecoration } from "@sdxc/u/typography";
import { createController } from "remix/router";

import type { UptimeModels } from "~/app/models";
import type { TrialSignupAttribution } from "~/app/models/trial-conversions";

import { relyingParty } from "~/app/auth/relying-party";
import { language as languageCookie, returnTo } from "~/app/http/cookies";
import { provisionCustomer } from "~/app/services/customer";
import { attributionProperties, trackAccountCreated } from "~/app/services/funnel-events";
import { convertTrialWatches } from "~/app/services/trial-conversion";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The slice of `remix/router`'s `RequestContext` the sign-in failure page renders from. */
interface AuthErrorContext {
	render: Renderer<RemixNode>;
	intl: I18n;
}

/**
 * The team this sign-in lands in: their own membership first, then a domain
 * join, then a fresh personal team — because a domain-joined team belongs to
 * the employer, and only an owned team should receive their anonymous history.
 */
async function resolveTeam(models: UptimeModels, idToken: IdToken) {
	let teams = await models.teams.listForSubject(idToken.subject);

	let [first] = teams;
	if (first) return teams.find((team) => team.owner_id === idToken.subject) ?? first;

	let joined = await models.memberships.joinByDomain(idToken);
	if (joined) return joined;

	/**
	 * Emits `account_created` here because reaching this branch means a team was
	 * just created for a brand-new account; `convertTrialWatches` emits its own
	 * for the free-page path, so summing the two counts every new account once.
	 */
	let created = unwrap(await models.teams.createPersonal(idToken));

	trackAccountCreated(currentLog(), {
		ownerId: idToken.subject,
		fromTrial: false,
		watchCount: 0,
		emailsSent: 0,
		...attributionProperties(),
	});

	return created;
}

/**
 * The three columns a conversion row stores, from the first touch. A missing touch stays
 * `undefined`, which the row records as unknown rather than as direct.
 */
function signupAttribution(touch: Touch | null): TrialSignupAttribution | undefined {
	if (!touch) return undefined;
	return {
		landingPath: touch.landingPath,
		source: touch.utm?.source ?? null,
		campaign: touch.utm?.campaign ?? null,
	};
}

/**
 * Seeds the `language` cookie from the subject's stored preference so the
 * page this redirects to loads already in their language — the cookie is the
 * only signal a normal request's language resolution reads before its database fallback.
 *
 * @returns Headers carrying the cookie, or undefined when there is no stored preference.
 */
async function languageHeaders(
	models: UptimeModels,
	subjectId: string,
): Promise<Headers | undefined> {
	let preferences = await models.userPreferences.findBy({ subject_id: subjectId });
	if (!preferences?.preferred_language) return undefined;

	let headers = new Headers();
	headers.append("Set-Cookie", await languageCookie.serialize(preferences.preferred_language));

	return headers;
}

/** Renders the sign-in failure page, showing `message` verbatim as supplied by the caller. */
function authError(ctx: AuthErrorContext, message: string) {
	return ctx.render(
		<DocumentLayout title={ctx.intl.t("auth.error.signInFailedTitle")}>
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
					<h1 mix={[m("0")]}>{ctx.intl.t("auth.error.signInFailedTitle")}</h1>
					<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>{message}</p>
					<a
						href={routes.home.href()}
						mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
					>
						{ctx.intl.t("errors.backHome")}
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
			let response = await relyingParty(ctx.url).authorize(contextOf(ctx), {
				returnTo: cookieReturnTo,
			});
			response.headers.append("Set-Cookie", await returnTo.serialize("", { maxAge: 0 }));
			return response;
		},

		/** GET /auth — completes the OIDC callback and establishes the session. */
		index: async (ctx) => {
			let finished = await wrap(() => relyingParty(ctx.url).callback(contextOf(ctx)));

			if (isFailure(finished)) {
				let error = finished.error;

				ctx.log.warn("auth.callback_failed", {
					code: error instanceof AuthError ? error.code : null,
					message: error.message,
					oauth_error: ctx.url.searchParams.get("error"),
					oauth_error_description: ctx.url.searchParams.get("error_description"),
				});

				if (AuthError.is(error, AuthErrorCode.MissingIdToken)) {
					return authError(ctx, ctx.intl.t("auth.error.missingIdToken"));
				}

				return authError(ctx, ctx.intl.t("auth.error.signInFailedGeneric"));
			}

			let grant = finished.data;
			let idToken = grant.idToken;

			/**
			 * Set here rather than by the auth middleware, which ran before this request had
			 * a session to resolve anybody from, so the record that provisions an account is
			 * attributed to the subject it provisioned it for.
			 */
			ctx.log.set({ user: { id: idToken.subject } });

			let customer = await provisionCustomer(ctx.billing, idToken);

			/**
			 * A sign-in completes whether or not billing answered: the customer is provisioned
			 * again on the next one, and the daily repair sweep reaches an owner who paid in the
			 * meantime, so a platform outage costs a login nothing.
			 */
			if (isFailure(customer)) {
				ctx.log.warn("auth.customer_provision_failed", {
					code: customer.error.code,
					provider_code: customer.error.providerCode,
					connection: customer.error.connection,
				});
			}

			let team = await resolveTeam(ctx.models, idToken);

			/**
			 * Runs after the team exists and before the redirect, so its monitors land in
			 * the team that redirect will already show. The service always resolves
			 * normally, so sign-in completes regardless of the conversion outcome.
			 */
			await convertTrialWatches(ctx.models, {
				email: idToken.email ?? "",
				teamId: team.id,
				authorId: idToken.subject,
				/**
				 * The first touch, read here because this request is the last one holding the
				 * anonymous session it was recorded into.
				 */
				attribution: signupAttribution(ctx.attribution.first),
			});

			let target = Location.safe(grant.returnTo, { fallback: routes.app.index.href() });
			return redirect(target, {
				status: redirect.Status.SeeOther,
				headers: await languageHeaders(ctx.models, idToken.subject),
			});
		},
	},
});
