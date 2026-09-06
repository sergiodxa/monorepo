/**
 * Logout controller for `/logout`: the GET shows a confirmation page and the POST drops the
 * local session, redirects through the identity provider's RP-initiated logout endpoint,
 * and sends `Clear-Site-Data` so the browser discards what it cached for this origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { isFailure, wrap } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { maxIs, mi, minBs, p } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Button, Heading } from "@sdxc/ui";
import { createController } from "remix/router";
import { Session } from "remix/session";

import { relyingParty } from "~/app/auth/relying-party";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Tells the browser to drop every other copy of this origin's state, so a shared machine
 * keeps nothing readable behind after a sign-out.
 */
const LOGOUT_HEADERS = { "Clear-Site-Data": '"*"' };

export default createController(routes.logout, {
	actions: {
		/**
		 * GET /logout — the confirmation page. Signing out is a `POST` from here, so a link
		 * prefetch or a mail scanner cannot end somebody's session by following a URL.
		 */
		index(ctx) {
			let title = ctx.i18next.t("logout.title");

			return ctx.render(
				<DocumentLayout title={title} locale={ctx.locale}>
					<main
						mix={[
							vstack({ gap: 6, align: "center", justify: "center" }),
							minBs("100dvh"),
							maxIs("36rem"),
							mi("auto"),
							p(8),
							textAlign("center"),
						]}
					>
						<Heading level={1}>{title}</Heading>
						<form method="post" action={routes.logout.action.href()} data-rmx-document="">
							<Button type="submit">{ctx.i18next.t("logout.cta")}</Button>
						</form>
					</main>
				</DocumentLayout>,
			);
		},

		/**
		 * POST /logout — drops the local session and signs out of the identity provider, whose
		 * `end_session_endpoint` the discovery document names. The local session is destroyed
		 * either way, so an unreachable provider still ends the session here.
		 */
		async action(ctx) {
			let ended = await wrap(() =>
				relyingParty(ctx.url).endSession(contextOf(ctx), {
					returnTo: routes.home.href(),
					redirect: false,
				}),
			);

			if (isFailure(ended)) {
				ctx.log.warn("auth.end_session_failed", { message: ended.error.message });
				ctx.get(Session)?.destroy();

				return redirect(routes.home.href(), {
					status: redirect.Status.SeeOther,
					headers: LOGOUT_HEADERS,
				});
			}

			return redirect(ended.data, {
				status: redirect.Status.SeeOther,
				headers: LOGOUT_HEADERS,
			});
		},
	},
});
