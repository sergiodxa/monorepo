import { redirect } from "@pkg/http/response";
import middleware from "@pkg/remix-helpers/middleware";

export default function createNoTrailingSlashMiddleware() {
	return middleware(async (ctx, next) => {
		let url = new URL(ctx.request.url);

		if (url.pathname.endsWith("/") && url.pathname !== "/") {
			url.pathname = url.pathname.slice(0, -1);
			return redirect(url.href, { status: redirect.Status.Permanent });
		}

		return next();
	});
}
