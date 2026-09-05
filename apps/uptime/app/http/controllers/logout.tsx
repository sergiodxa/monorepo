/**
 * Logout controller for `/logout`: the GET shows a confirmation page and the POST drops the
 * local session, redirects through the identity provider's RP-initiated logout endpoint, and
 * sends `Clear-Site-Data` so the browser clears what it cached for this origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { isFailure, wrap } from "@sdxc/result";
import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexCol, gap, items } from "@sdxc/u/layout";
import { dark } from "@sdxc/u/responsive";
import { m, minBs, p } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Button } from "@sdxc/ui";
import { createController } from "remix/router";
import { Session } from "remix/session";

import { relyingParty } from "~/app/auth/relying-party";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Tells the browser to drop every other copy of this origin's state, so a shared
 * machine keeps nothing readable behind after a sign-out.
 */
const LOGOUT_HEADERS = { "Clear-Site-Data": '"*"' };

export default createController(routes.logout, {
	actions: {
		/** GET /logout — confirmation page. */
		index(ctx) {
			return ctx.render(
				<DocumentLayout title={ctx.i18next.t("page.logout.title")}>
					<main mix={[flex(), flexCol(), minBs("100vh")]}>
						<div
							mix={[
								flex(),
								flexCol(),
								items("center"),
								textAlign("center"),
								gap(3),
								p(16, 8),
								border({ color: "oklch(0.83 0.011 250)", width: 1, style: "dashed" }),
								rounded("12px"),
								dark(border("oklch(0.42 0.012 250)")),
							]}
						>
							<h1 mix={[m(0)]}>{ctx.i18next.t("page.logout.title")}</h1>
							<form method="post" action={routes.logout.action.href()} data-rmx-document="">
								<Button type="submit">{ctx.i18next.t("page.logout.cta")}</Button>
							</form>
						</div>
					</main>
				</DocumentLayout>,
			);
		},

		/**
		 * POST /logout — drops the local session and signs out of the identity provider,
		 * whose `end_session_endpoint` the discovery document names. The local session is
		 * destroyed either way, so an unreachable provider still ends the session here.
		 */
		async action(ctx) {
			let ended = await wrap(() =>
				relyingParty(ctx.url).endSession(contextOf(ctx), {
					returnTo: routes.home.href(),
					redirect: false,
				}),
			);

			if (isFailure(ended)) {
				ctx.logger.error("auth.end_session_failed", { error: ended.error.message });
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
