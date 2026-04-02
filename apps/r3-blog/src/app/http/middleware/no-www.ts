import { redirect } from "@pkg/http/response";
import middleware from "@pkg/remix-helpers/middleware";

export default middleware(async (ctx, next) => {
	let url = new URL(ctx.request.url);

	if (url.hostname.startsWith("www.")) {
		url.hostname = url.hostname.slice(4);
		return redirect(url.href, { status: redirect.Status.Permanent });
	}

	return next();
});
