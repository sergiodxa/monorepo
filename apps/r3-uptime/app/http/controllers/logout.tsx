/**
 * Logout controller for `/logout`. The `index` (GET) shows a confirmation page; the
 * `action` (POST) destroys the local session and redirects through the auth server's
 * RP-initiated logout endpoint (SSO sign-out) with `Clear-Site-Data`, matching the OLD
 * APP's session-clearing behavior.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { createController } from "remix/fetch-router";

import { getIdToken, logout } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import LogoutView from "~/resources/views/logout";
import routes from "~/routes/web";

export default createController(routes.logout, {
	actions: {
		/** GET /logout — confirmation page. */
		index(ctx) {
			let renderDocument = DocumentLayout();
			return ctx.render(renderDocument({ title: "Sign out", children: <LogoutView /> }));
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
