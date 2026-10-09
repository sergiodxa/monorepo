/**
 * Route middleware for a fragment of a page: when the route throws or answers with a status
 * that is not content, it answers the note saying a piece of the page did not load, as a
 * `200` fragment the renderer writes in place, and says what happened to the log instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";

import FrameFallback from "~/resources/views/frame-fallback";

/** The header the server's renderer names the document a frame is being drawn into with. */
const TOP_FRAME_SRC_HEADER = "x-remix-top-frame-src";

/**
 * Keeps a failed fragment to the region it was drawn into: a blocking frame whose request
 * throws fails the whole document around it, and an error page written into a region puts a
 * second document inside the first. Redirects pass through, since the renderer follows them.
 *
 * The note's way on is the document the frame sits in — named by the renderer, or by the
 * browser's `Referer` for a frame the client reloads — because the fragment's own address
 * answers only a piece of a page.
 */
export let frameFallback: Middleware = async (ctx, next) => {
	let response: Response;

	try {
		response = await next();
	} catch (error) {
		currentLog()?.fail(error, { frame: { src: ctx.request.url, failed: true } });
		return renderNote();
	}

	if (response.ok || (response.status >= 300 && response.status < 400)) return response;

	currentLog()?.warn("frame.no_content", { src: ctx.request.url, status: response.status });
	await response.body?.cancel();

	return renderNote();

	/** The note in place of the fragment, written in the request's own language. */
	function renderNote() {
		let retryHref =
			ctx.request.headers.get(TOP_FRAME_SRC_HEADER) ??
			ctx.request.headers.get("referer") ??
			ctx.url.origin;

		return ctx.render(
			<FrameFallback
				message={ctx.intl.t("frame.failed")}
				retryLabel={ctx.intl.t("frame.retry")}
				retryHref={retryHref}
			/>,
		);
	}
};

export default frameFallback;
