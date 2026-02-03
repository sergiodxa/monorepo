import type { MiddlewareFunction } from "react-router";

import { redirect } from "react-router";

function createNoTrailingSlashMiddleware(): MiddlewareFunction<Response> {
	return async function noTrailingSlashMiddleware({ request }, next) {
		let url = new URL(request.url);

		if (url.pathname.endsWith("/") && url.pathname !== "/") {
			throw redirect(url.toString().slice(0, url.toString().length - 1));
		}

		return await next();
	};
}

export const noTrailingSlashMiddleware = createNoTrailingSlashMiddleware();
