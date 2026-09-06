/**
 * Authentication controller for `/auth`: the POST starts the OIDC authorization-code flow
 * and the GET completes the callback. A successful callback has nothing to provision — a
 * reader's subscriptions are keyed on the OIDC subject — so it lands straight on the queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { AuthError, AuthErrorCode } from "@sdxc/auth/auth-error";
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { isFailure, wrap } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { maxIs, mi, minBs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { fontSize, textAlign, textDecoration } from "@sdxc/u/typography";
import { Heading, Text } from "@sdxc/ui";
import { createController } from "remix/router";

import { relyingParty } from "~/app/auth/relying-party";
import { RETURN_TO_COOKIE } from "~/app/http/cookies";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The slice of `remix/router`'s `RequestContext` the sign-in failure page renders from. */
interface AuthErrorContext {
	render: Renderer<RemixNode>;
	i18next: i18n;
	locale: string;
}

/** Renders the sign-in failure page, showing `message` verbatim as supplied by the caller. */
function authError(ctx: AuthErrorContext, message: string) {
	let title = ctx.i18next.t("auth.error.title");

	return ctx.render(
		<DocumentLayout title={title} locale={ctx.locale}>
			<main
				mix={[
					vstack({ gap: 3, align: "center", justify: "center" }),
					minBs("100dvh"),
					maxIs("36rem"),
					mi("auto"),
					p(8),
					textAlign("center"),
				]}
			>
				<Heading level={1}>{title}</Heading>
				<Text mix={[fontSize("sm"), fg("neutral.muted")]}>{message}</Text>
				<a
					href={routes.home.href()}
					mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
				>
					{ctx.i18next.t("notFound.goBackHome")}
				</a>
			</main>
		</DocumentLayout>,
		{ status: 400 },
	);
}

export default createController(routes.auth, {
	actions: {
		/**
		 * POST /auth — starts the OIDC authorization-code flow, moving any pending `returnTo`
		 * out of its cookie and into the session-backed login transaction the callback reads,
		 * then clearing the cookie so a later sign-in cannot inherit a stale destination.
		 */
		async action(ctx) {
			let cookieReturnTo = await RETURN_TO_COOKIE.parse(ctx.request.headers.get("Cookie"));

			let response = await relyingParty(ctx.url).authorize(contextOf(ctx), {
				returnTo: cookieReturnTo,
			});

			response.headers.append("Set-Cookie", await RETURN_TO_COOKIE.serialize("", { maxAge: 0 }));

			return response;
		},

		/**
		 * GET /auth — completes the OIDC callback and establishes the session. A refused
		 * callback renders the failure page rather than redirecting, so the reason stays on
		 * screen instead of being lost to a redirect.
		 */
		async index(ctx) {
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
					return authError(ctx, ctx.i18next.t("auth.error.missingIdToken"));
				}

				return authError(ctx, ctx.i18next.t("auth.error.generic"));
			}

			/**
			 * Set here rather than by the auth middleware, which ran before this request had a
			 * session to resolve anybody from, so the record that establishes a session is
			 * attributed to the subject it established it for.
			 */
			ctx.log.set({ user: { id: finished.data.idToken.subject } });

			return redirect(routes.reading.href(), { status: redirect.Status.SeeOther });
		},
	},
});
