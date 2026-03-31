import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { authState } from "~/middleware/auth-state";
import { LogoutView } from "~/views/auth/logout";

export default controller<typeof routes.auth.logout>({
	middleware: [
		() => {
			let auth = authState();
			if (!auth.isAuthenticated) return redirect("/", { status: redirect.Status.SeeOther });
		},
	],
	actions: {
		async index() {
			let body = await renderToString(
				<BlogLayout title="Logout" description="Sign out from CMS" activePath="/logout">
					<LogoutView />
				</BlogLayout>,
			);

			return ok(body);
		},

		action(ctx) {
			let auth = authState();

			let idToken = auth.getIdToken();
			let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
			if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
			logoutUrl.searchParams.set(
				"post_logout_redirect_uri",
				new URL("/", ctx.request.url).toString(),
			);

			let response = redirect(logoutUrl, {
				status: redirect.Status.SeeOther,
				headers: {
					"Clear-Site-Data": '"*"',
				},
			});

			auth.logout();

			return response;
		},
	},
});
