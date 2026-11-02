/**
 * `GET /demo/frames/docs/:site/*part` — one interactive piece of a docs demo page as an HTML
 * fragment, such as its feedback form or a live example, cached on its own per address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import routes from "~/routes/web";

/** Answers `404` with an empty fragment until a docs demo names its pieces. */
export default createAction(routes.demoFrames.docs, async () => {
	return new Response("", { status: 404, headers: { "Content-Type": "text/html" } });
});
