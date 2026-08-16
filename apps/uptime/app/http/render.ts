/**
 * The app's request-scoped SSR renderer and its frame resolver. Streams `remix/ui` JSX
 * as HTML and fetches every `<Frame>`'s `src` back through the router that is rendering
 * the document, so a fragment shares the request's cookies and middleware chain instead
 * of going out over the network.
 *
 * It lives here rather than in `bootstrap/app.tsx` so tests can exercise the real
 * resolver: a page test that supplies its own stub can pass while every frame on the
 * page is broken, which is exactly how a page with two dead frames reaches production.
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
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, src, target, context);
			},
			// The renderer's default hook writes to the console, which a Worker drops on the
			// floor. Whatever still reaches here has already cost the visitor a piece of the
			// page, so it has to leave a record somewhere someone will read.
			onError(error) {
				logger.error("render.stream_failed", {
					url: ctx.request.url,
					error: error instanceof Error ? error.message : String(error),
				});
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		// `createHtmlResponse` rather than `new Response`, because it prepends
		// `<!DOCTYPE html>` to the stream's first chunk — the only place the doctype
		// can go, since JSX escapes text and the renderer exposes no option for it.
		// Without it every page parses in quirks mode. Fragment responses get one
		// too, which is harmless: `remix/ui` strips any doctype out of frame content
		// before inserting it, on the server and in the browser alike.
		return createHtmlResponse(stream, { ...init, headers });
	};
}

/**
 * Fetches frame HTML through the current router so SSR frames share request context.
 *
 * Never fails, and that is the whole contract. `remix/ui` streams a non-blocking frame's
 * content as a `<template>` the client swaps over the fallback; when a frame fails to
 * produce that content, the renderer swallows the error into its `onError` hook, no
 * template is ever streamed, and the client waits for one forever — so the visitor is
 * left staring at a skeleton with nothing written down anywhere about why. A frame that
 * fails has to *say so* in the page. Every failure — a handler that threw, a redirect
 * loop, an aborted request — comes back as the same visible marker a non-ok response
 * does.
 *
 * Which is why the body is read to a string here rather than handed back as
 * `res.body`. A fragment response's headers exist long before its HTML does: `ctx.render`
 * returns as soon as its stream is created, and the JSX is rendered into that stream
 * afterwards. Returning the stream would move every failure that happens during that
 * render — a component that throws, a query that rejects mid-tree — outside this
 * function, where the catch below can no longer see it and the renderer drops the
 * template instead. Awaiting the text pulls those failures back in. A card fragment is
 * small enough that giving up its incremental delivery costs nothing next to a frame
 * that can silently never arrive.
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

		// Status before body: an error response carries a body of its own (a 404 renders
		// the not-found page), and returning it would paste that page into the frame as
		// though it were the fragment's own content.
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

/** Follows SSR frame redirects without letting fetch auto-follow with changed headers. */
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
