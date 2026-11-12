/**
 * `GET /demo/frames/apps/:app/*part` — one secondary part of a demo app screen as an HTML
 * fragment, which the screen streams in after its shell. Each part is cached on its own,
 * per address and per value of the cookies its app reads, unless drawn for one visitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { cookieVariant, withStreamCache } from "~/app/http/caching";
import { findDemoApp } from "~/resources/views/demo-apps";
import routes from "~/routes/web";

/** The `:app` and `*part` the frame names. */
const PARAMS = s.object({ app: s.string(), part: s.string() });

/**
 * Answers the part's fragment as the renderer streams it, so a blocking use of it inlines it
 * whole. An unknown app or part answers `404` with an empty fragment, which a frame draws as
 * nothing rather than as another page.
 */
export default createAction(routes.demoFrames.app, async (ctx) => {
	let { app: slug, part } = s.parse(PARAMS, ctx.params);
	let app = await findDemoApp(slug);
	if (app === null || app.frame === undefined) return notFound();

	let cookie = ctx.request.headers.get("Cookie");
	let node = await app.frame(part, { page: part, url: ctx.url, cookie });
	if (node === null) return notFound();

	if (app.isPersonal?.(cookie)) return ctx.render(node);
	let variant = `${ctx.url.search}|${cookieVariant(cookie, app.cookies)}`;
	return await withStreamCache(ctx.request, variant, async () => ctx.render(node));
});

/** The empty fragment a frame naming no part answers with. */
function notFound(): Response {
	return new Response("", { status: 404, headers: { "Content-Type": "text/html" } });
}
