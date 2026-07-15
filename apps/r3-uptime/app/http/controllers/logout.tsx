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
import { createController } from "remix/fetch-router";
import { css } from "remix/ui";

import { getIdToken, logout } from "~/app/http/middleware/auth";
import Button from "~/resources/components/button";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createController(routes.logout, {
	actions: {
		/** GET /logout — confirmation page. */
		index(ctx) {
			return ctx.render(
				<DocumentLayout title="Sign out">
					<main mix={[css({ display: "flex", flexDirection: "column", minHeight: "100vh" })]}>
						<div
							mix={[
								css({
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									textAlign: "center",
									gap: 12,
									padding: "64px 32px",
									border: "1px dashed oklch(0.83 0.01 145)",
									borderRadius: 12,
									"@media (prefers-color-scheme: dark)": {
										borderColor: "oklch(0.42 0.008 145)",
									},
								}),
							]}
						>
							<h1 mix={[css({ margin: 0 })]}>{ctx.i18next.t("page.logout.title")}</h1>
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
