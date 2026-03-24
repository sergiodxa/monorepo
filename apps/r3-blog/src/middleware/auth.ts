import { redirect } from "@pkg/http/response";
import middleware from "@pkg/remix-helpers/middleware";

import { authState } from "~/middleware/auth-state";

export default middleware((ctx, next) => {
	let url = new URL(ctx.request.url);
	let pathname = url.pathname;
	let auth = authState();

	if (!auth.isAuthenticated) {
		let loginUrl = new URL("/login", url);
		loginUrl.searchParams.set("next", `${pathname}${url.search}`);
		return redirect(loginUrl.toString(), { status: redirect.Status.SeeOther });
	}

	if (!auth.isAdmin) {
		return redirect("/", { status: redirect.Status.SeeOther });
	}

	return next();
});
