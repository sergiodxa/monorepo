import { redirect } from "@pkg/http/response";
import middleware from "@pkg/remix-helpers/middleware";

export const authMiddleware = middleware((ctx, next) => {
	let url = new URL(ctx.request.url);
	let pathname = url.pathname;

	if (!pathname.startsWith("/cms")) return next();

	if (!ctx.auth.isAuthenticated) {
		let loginUrl = new URL("/login", url);
		loginUrl.searchParams.set("next", `${pathname}${url.search}`);
		return redirect(loginUrl.toString(), { status: redirect.Status.SeeOther });
	}

	if (!ctx.auth.isAdmin) {
		return redirect("/", { status: redirect.Status.SeeOther });
	}

	return next();
});
