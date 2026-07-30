/**
 * Logout controller for `/logout`. The `index` (GET) shows a confirmation page; the
 * `action` (POST) destroys the local session and redirects through the auth server's
 * RP-initiated logout endpoint (SSO sign-out), also sending `Clear-Site-Data` so the
 * browser drops any other locally cached state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { Button } from "@pkg/r3-ui";
import { border } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { dark } from "@pkg/u/responsive";
import { m, minBs, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";
import { createController } from "remix/fetch-router";

import { getIdToken, logout } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

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
							<form method="post" action={routes.logout.action.href()}>
								<Button type="submit">{ctx.i18next.t("page.logout.cta")}</Button>
							</form>
						</div>
					</main>
				</DocumentLayout>,
			);
		},

		/** POST /logout — destroys the session and signs out of the identity provider. */
		action(ctx) {
			let idToken = getIdToken();

			let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
			if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
			logoutUrl.searchParams.set(
				"post_logout_redirect_uri",
				new URL(routes.home.href(), ctx.request.url).toString(),
			);

			logout();

			return redirect(logoutUrl, {
				status: redirect.Status.SeeOther,
				headers: { "Clear-Site-Data": '"*"' },
			});
		},
	},
});
