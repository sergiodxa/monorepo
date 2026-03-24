import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { startAuthentication } from "~/modules/auth";
import { LoginView } from "~/views/login";

export default action<typeof routes.auth.login>(async (ctx) => {
	if (ctx.auth.isAuthenticated) {
		return redirect("/cms", { status: redirect.Status.SeeOther });
	}

	let url = new URL(ctx.request.url);
	if (url.searchParams.get("start") === "1") {
		return startAuthentication(ctx.request);
	}

	let next = normalizeNextPath(url.searchParams.get("next"));
	let body = await renderToString(
		<BlogLayout title="Login" description="Authenticate to access CMS tools" activePath="/login">
			<LoginView next={next} />
		</BlogLayout>,
	);

	return ok(body);
});

function normalizeNextPath(value: string | null) {
	if (!value || !value.startsWith("/") || value.startsWith("//")) return "/cms";
	if (value === "/login") return "/cms";
	return value;
}
