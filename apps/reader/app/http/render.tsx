/**
 * The app's request-scoped SSR renderer and its frame resolver. Streams `remix/ui` JSX as
 * HTML and fetches every `<Frame>`'s `src` back through the router that is rendering the
 * document, so a fragment shares the request's cookies and middleware chain instead of
 * going out over the network.
 *
 * A frame that does not answer leaves a note in its place saying so, and what went wrong
 * goes to the log: a status line or a thrown message is news about the server rather than
 * about the reading, and the rest of the page arrived and is fine.
 *
 * It lives beside the controllers rather than in `bootstrap/` so a test can exercise the
 * real resolver: a page test that supplies its own stub passes while every frame on the
 * page is broken.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";
import type { RequestContext, Router } from "remix/router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import { currentLog } from "@sdxc/logger";
import { createHtmlResponse } from "remix/response/html";
import { renderToStream, renderToString } from "remix/ui/server";

import FrameFallback from "~/resources/views/frame-fallback";

/** How many redirects a frame's sub-request may follow before it is treated as a loop. */
const MAX_FRAME_REDIRECTS = 10;

/** The header the resolver below sends, naming a sub-request as a frame's. */
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

/** Creates a request-scoped renderer for server-side HTML responses. */
export function createHtmlRenderer(ctx: RequestContext) {
	/**
	 * Streams `node` to an HTML response, logging failures explicitly since a Worker
	 * discards the default console-based error hook, and prepending `<!DOCTYPE html>` via
	 * `createHtmlResponse` since JSX cannot express a doctype directly.
	 */
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, ctx.i18next, src, target, context);
			},
			onError(error) {
				currentLog()?.fail(error, { render: { failed: true } });
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		/**
		 * A fragment is written into a document that already declared one, so it is sent as
		 * the markup it is; the doctype belongs to whichever response opens the document.
		 */
		if (isFrameRequest(ctx.request)) {
			return new Response(stream, { ...init, headers });
		}

		return createHtmlResponse(stream, { ...init, headers });
	};
}

/**
 * Fetches frame HTML through the current router so an SSR frame shares the request's
 * context. A frame that answers with anything but content leaves the note below in its
 * place, and says what happened to the log rather than to the reader.
 *
 * @param router - The router rendering the document, which the fragment is fetched through.
 * @param request - The document's own request, for its cookies and for where a reader asks
 * again from.
 * @param i18next - The request's dictionary, which the note is written in.
 * @param src - The frame's address, resolved against the frame currently rendering.
 * @param target - The named frame a reload is aimed at, when one is.
 * @param context - Where the frame being rendered sits, which `src` resolves against.
 */
export async function resolveFrame(
	router: Router,
	request: Request,
	i18next: i18n,
	src: string,
	target?: string,
	context?: ResolveFrameContext,
) {
	try {
		let frameSrc = context?.currentFrameSrc ?? request.url;
		let url = new URL(src, frameSrc);
		let headers = new Headers();
		headers.set("accept", "text/html");
		headers.set("accept-encoding", "identity");
		headers.set(FRAME_HEADER, "true");

		if (target) headers.set("x-remix-target", target);

		let cookie = request.headers.get("cookie");
		if (cookie) headers.set("cookie", cookie);

		let res = await followFrameRedirects(router, request, url, headers);

		if (!res.ok) {
			currentLog()?.warn("frame.no_content", { src: url.toString(), status: res.status });

			return await frameFallback(i18next, request);
		}

		return await res.text();
	} catch (error) {
		currentLog()?.fail(error, { frame: { src, failed: true } });

		return await frameFallback(i18next, request);
	}
}

/**
 * The note a failed frame renders in place of its content. Markup rather than a string
 * built by hand, so it wears the app's own components and the escaping stays in the one
 * place that does it.
 *
 * @param i18next - The request's dictionary.
 * @param request - The document the frame sits in, which is what asking again fetches.
 */
async function frameFallback(i18next: i18n, request: Request): Promise<string> {
	let markup = await renderToString(
		<FrameFallback
			message={i18next.t("frame.failed")}
			retryLabel={i18next.t("frame.retry")}
			retryHref={request.url}
		/>,
	);

	/**
	 * The renderer collects the note's styles into a document head, and this goes into a
	 * page that already has one. The rules travel with the markup — they are minted for this
	 * render and nothing else declares them — so the wrapper is taken off and the `style`
	 * elements are left where they land, which is content a body is allowed to hold.
	 */
	return markup.replaceAll(/<\/?head>/g, "");
}

/** Follows SSR frame redirects manually, preserving the request's custom headers across each hop. */
async function followFrameRedirects(router: Router, request: Request, url: URL, headers: Headers) {
	let currentUrl = url;
	let redirectsRemaining = MAX_FRAME_REDIRECTS;

	while (true) {
		let res = await router.fetch(
			new Request(currentUrl, { method: "GET", headers, signal: request.signal }),
		);
		let location = res.headers.get("location");
		if (!location || res.status < 300 || res.status >= 400) return res;

		if (redirectsRemaining-- <= 0) throw new Error("Too many frame redirects");
		currentUrl = new URL(location, currentUrl);
	}
}
