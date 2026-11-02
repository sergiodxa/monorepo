/**
 * `GET /demo/frames/docs/:site/*part` — one interactive piece of a docs demo page as an HTML
 * fragment, cached on its own per address. Today that is a page's feedback block, served at
 * `feedback/<page path>` with `?feedback=sent` once the reader has voted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withStreamCache } from "~/app/http/caching";
import { findDemoDocsSite } from "~/resources/views/demo-docs";
import {
	DemoDocsFeedback,
	FEEDBACK_PART,
	FEEDBACK_SENT_PARAM,
} from "~/resources/views/demo-docs/feedback";
import routes from "~/routes/web";

/** The `:site` and `*part` the frame names. */
const PARAMS = s.object({ site: s.string(), part: s.string() });

/**
 * Answers the piece's fragment as the renderer streams it, which a page's blocking frame
 * inlines. An unknown site, part or page answers `404` with an empty fragment, so a frame
 * naming one draws nothing instead of another page.
 */
export default createAction(routes.demoFrames.docs, async (ctx) => {
	let { part, site: slug } = s.parse(PARAMS, ctx.params);
	let prefix = `${FEEDBACK_PART}/`;
	if (!part.startsWith(prefix)) return notFound();

	let path = part.slice(prefix.length);
	let site = await findDemoDocsSite(slug);
	if (site === null || !Object.hasOwn(site.pages, path)) return notFound();

	let sent = ctx.url.searchParams.get(FEEDBACK_SENT_PARAM) === "sent";
	return await withStreamCache(ctx.request, ctx.url.search, async () =>
		ctx.render(<DemoDocsFeedback slug={slug} path={path} sent={sent} />),
	);
});

/** The empty fragment a frame naming no piece answers with. */
function notFound(): Response {
	return new Response("", { status: 404, headers: { "Content-Type": "text/html" } });
}
