/**
 * The app's HTML rendering: `remix/component` JSX streamed through the standard renderer, which
 * resolves each island's module-URL identity to its built chunk and fetches every `<Frame>`
 * back through the router, wrapped so the document shell finds its assets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Middleware, RequestContext } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { SecurityHeadersKey } from "@sdxc/security-headers/middleware";
import { render, renderWith } from "remix/middleware/render";

import { assets, documentAssets } from "~/app/lib/assets";
import { DocumentAssets } from "~/resources/layouts/document";

/** The header the renderer sends, naming a sub-request as a frame's. */
const FRAME_HEADER = "x-remix-frame";

/**
 * The parameter a frame's own address carries, saying the answer is a fragment of a page
 * rather than the page.
 *
 * It rides in the URL rather than in a header because the client runtime resolves an
 * ordinary link navigation through the same resolver a frame goes through: a header added
 * there would turn every soft navigation into a fragment. The address is the one thing
 * only a frame has.
 */
export const FRAME_PARAM = "frame";

/**
 * What {@link FRAME_PARAM} carries for the piece continuing a page downward, into posts
 * older than the ones on screen. It is the direction a list is normally walked, and the
 * value a frame's address carries unless it says otherwise.
 */
export const FRAME_OLDER = "older";

/**
 * And for the piece continuing a page upward, into posts newer than the ones on screen.
 * The two differ in which end of the fragment carries the way on: the page at the other
 * end is already in the document this is written into.
 */
export const FRAME_NEWER = "newer";

/**
 * Whether this request is for a fragment of a page. The server's resolver says so in a
 * header it sets itself; a frame whose address was built for it says so in that address.
 *
 * @param request - The request being answered.
 */
export function isFrameRequest(request: Request): boolean {
	if (request.headers.has(FRAME_HEADER)) return true;
	return new URL(request.url).searchParams.has(FRAME_PARAM);
}

/**
 * Renders a page wrapped in what the document shell reads: the asset manifest's stylesheets
 * and client entry, looked up per render, and the response's nonce for the inline import map.
 * The nonce is read before the stream starts, because the policy header is written ahead of
 * the body; a fragment renders no shell, so its response advertises none.
 *
 * @param ctx - The request being answered, whose `render` it wraps.
 */
export function withDocumentAssets(ctx: RequestContext) {
	let renderPage = ctx.render;

	return async function renderDocument(node: RemixNode, init?: ResponseInit) {
		let documentAssetsValue = await documentAssets();
		let nonce =
			isFrameRequest(ctx.request) || !ctx.has(SecurityHeadersKey)
				? undefined
				: ctx.get(SecurityHeadersKey)?.nonce;

		return await renderPage(
			<DocumentAssets value={{ ...documentAssetsValue, nonce }}>{node}</DocumentAssets>,
			init,
		);
	};
}

/**
 * The middleware pair that installs `ctx.render`, in order. Render failures go to the log
 * explicitly, since a Worker discards the default console-based error hook.
 */
export function htmlRendering(): Middleware[] {
	return [
		render({
			assets,
			onError(error) {
				currentLog()?.fail(error, { render: { failed: true } });
			},
		}) as Middleware,
		renderWith(withDocumentAssets) as Middleware,
	];
}
