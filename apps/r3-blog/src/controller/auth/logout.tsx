import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { authState } from "~/middleware/auth-state";
import { LogoutView } from "~/views/auth/logout";

export default action<typeof routes.auth.logout>(async (ctx) => {
	let auth = authState();

	if (!auth.isAuthenticated) {
		return redirect("/", { status: redirect.Status.SeeOther });
	}

	let url = new URL(ctx.request.url);
	let isStartingFlow = url.searchParams.get("start") === "1";
	if (!isStartingFlow) {
		let body = await renderToString(
			<BlogLayout title="Logout" description="Sign out from CMS" activePath="/logout">
				<LogoutView />
			</BlogLayout>,
		);

		return ok(body);
	}

	let idToken = auth.getIdToken();
	let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
	if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
	logoutUrl.searchParams.set("post_logout_redirect_uri", new URL("/", ctx.request.url).toString());

	let response = redirect(logoutUrl, {
		status: redirect.Status.SeeOther,
		headers: {
			"Clear-Site-Data": '"*"',
		},
	});

	auth.logout();

	return response;
});
