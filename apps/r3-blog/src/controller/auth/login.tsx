import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { authState } from "~/middleware/auth-state";
import { authenticate } from "~/modules/oauth";
import { LoginView } from "~/views/auth/login";

export default action<typeof routes.auth.login>(async (ctx) => {
	if (authState().isAuthenticated) {
		return redirect("/cms", { status: redirect.Status.SeeOther });
	}

	let url = new URL(ctx.request.url);
	if (url.searchParams.get("start") === "1") {
		let response = await authenticate(ctx.request);
		if (response instanceof Response) return response;
		return redirect("/login", { status: redirect.Status.SeeOther });
	}

	let body = await renderToString(
		<BlogLayout title="Login" description="Authenticate to access CMS tools" activePath="/login">
			<LoginView />
		</BlogLayout>,
	);

	return ok(body);
});
