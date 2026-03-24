import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { buildLogoutUrl, clearAuthFlowCookies } from "~/modules/auth";
import { LogoutView } from "~/views/logout";

export default action<typeof routes.auth.logout>(async (ctx) => {
	if (!ctx.auth.isAuthenticated) {
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

	let idToken = ctx.auth.getIdToken();
	let logoutUrl = buildLogoutUrl(ctx.request, idToken);
	let response = redirect(logoutUrl, {
		status: redirect.Status.SeeOther,
		headers: {
			"Clear-Site-Data": '"*"',
		},
	});

	ctx.auth.logout();

	for (let cookie of clearAuthFlowCookies()) {
		response.headers.append("Set-Cookie", cookie);
	}

	return response;
});
