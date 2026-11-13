/**
 * `GET /demo/apps/:app/streams/*part` — a live part of a demo app's screen as a streamed
 * `text/plain` body, such as a running job's log. Nothing is cached or buffered, so the page
 * appends each line the moment it is written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { findDemoApp } from "~/resources/views/demo-apps";
import routes from "~/routes/web";

/** The `:app` and `*part` the stream names. */
const PARAMS = s.object({ app: s.string(), part: s.string() });

/**
 * Answers the part's text as the app writes it, encoded as UTF-8 and marked uncacheable; an
 * unknown app or part answers `404` with an empty body.
 */
export default createAction(routes.demoStreams.app, async (ctx) => {
	let { app: slug, part } = s.parse(PARAMS, ctx.params);
	let app = await findDemoApp(slug);
	let stream =
		app?.stream?.(part, {
			page: part,
			url: ctx.url,
			cookie: ctx.request.headers.get("Cookie"),
		}) ?? null;
	if (stream === null) {
		return new Response("", { status: 404, headers: { "Content-Type": "text/plain" } });
	}
	return new Response(stream.pipeThrough(new TextEncoderStream()), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
});
