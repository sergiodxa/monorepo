/**
 * The app's request-scoped SSR renderer and its frame resolver. Streams `remix/ui` JSX
 * as HTML and fetches every `<Frame>`'s `src` back through the router that is rendering
 * the document, so a fragment shares the request's cookies and middleware chain instead
 * of going out over the network.
 *
 * Living in this module lets tests exercise the real resolver: a page test that supplies
 * its own stub can pass while every frame on the page is broken, which is exactly how a
 * page with two dead frames reaches production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext, Router } from "remix/router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import { logger } from "@pkg/logger";
import { createHtmlResponse } from "remix/response/html";
import { renderToStream } from "remix/ui/server";

/** How many redirects a frame's sub-request may follow before it is treated as a loop. */
const MAX_FRAME_REDIRECTS = 10;

/** Creates a request-scoped renderer for server-side HTML responses. */
export function createHtmlRenderer(ctx: RequestContext) {
	/**
	 * Streams `node` to an HTML response, logging failures explicitly since a Worker
	 * discards the default console-based error hook, and prepends `<!DOCTYPE html>`
	 * via `createHtmlResponse` since JSX cannot express a doctype directly.
	 */
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, src, target, context);
			},
			onError(error) {
				logger.error("render.stream_failed", {
					url: ctx.request.url,
					error: error instanceof Error ? error.message : String(error),
				});
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return createHtmlResponse(stream, { ...init, headers });
	};
}

/**
 * Fetches frame HTML through the current router so SSR frames share request context.
 * Every failure surfaces immediately as a visible in-page marker, since the body is
 * read to text so render failures surface here too.
 */
export async function resolveFrame(
	router: Router,
	request: Request,
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
		headers.set("x-remix-frame", "true");

		if (target) headers.set("x-remix-target", target);

		let cookie = request.headers.get("cookie");
		if (cookie) headers.set("cookie", cookie);

		let res = await followFrameRedirects(router, request, url, headers);

		if (!res.ok) return frameError(`${res.status} ${res.statusText}`);

		return await res.text();
	} catch (error) {
		return frameError(error instanceof Error ? error.message : String(error));
	}
}

/** The marker a failed frame renders in place of its content, so the failure is on the page. */
function frameError(reason: string): string {
	return `<pre>Frame error: ${escapeHtml(reason)}</pre>`;
}

/** Escapes a failure reason, which can carry an arbitrary thrown message, for text content. */
function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
