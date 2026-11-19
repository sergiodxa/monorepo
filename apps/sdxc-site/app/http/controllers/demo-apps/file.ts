/**
 * `GET /demo/apps/:app/files/*part` — a file a demo app offers, such as a calendar to download
 * or subscribe to. The app writes the whole response, content type included, and the answer is
 * never stored, since it is drawn from the visitor's own cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { findDemoApp } from "~/resources/views/demo-apps";
import routes from "~/routes/web";

/** The `:app` and `*part` the file names. */
const PARAMS = s.object({ app: s.string(), part: s.string() });

/**
 * Answers the app's file with `Cache-Control: private, no-store` and `nosniff` set over what the
 * app wrote; an unknown app, an app without files, or a part it lacks answers `404`.
 */
export default createAction(routes.demoFiles.app, async (ctx) => {
	let { app: slug, part } = s.parse(PARAMS, ctx.params);
	let app = await findDemoApp(slug);
	let response =
		(await app?.file?.(part, {
			page: part,
			url: ctx.url,
			cookie: ctx.request.headers.get("Cookie"),
		})) ?? null;
	if (response === null) {
		return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
	}
	let headers = new Headers(response.headers);
	headers.set("Cache-Control", "private, no-store");
	headers.set("X-Content-Type-Options", "nosniff");
	return new Response(response.body, { status: response.status, headers });
});
