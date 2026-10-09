/**
 * Turns a failed server-side frame sub-request into a visible in-page marker. The renderer
 * leaves a frame whose sub-request rejects on its skeleton for good, so a fragment that throws,
 * answers an error status, or fails while its body streams answers a marker the page shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";

/**
 * Wraps every request the renderer issues to resolve a `<Frame>` (marked `X-Remix-Frame: true`),
 * covering the fragment's own middleware and handler. A thrown error and a 4xx/5xx answer become
 * a 200 HTML marker naming the failure; a body that errors mid-stream ends with the same marker.
 * Redirects pass through, since the renderer follows them to the page they name.
 */
export function frameFailures(): Middleware {
	return async (ctx, next) => {
		if (ctx.request.headers.get("x-remix-frame") !== "true") return next();

		let response: Response;
		try {
			response = await next();
		} catch (error) {
			currentLog()?.fail(error, { render: { failed: true, frame: ctx.url.pathname } });
			return frameError(errorMessage(error));
		}

		if (response.status >= 400) {
			await response.body?.cancel();
			currentLog()?.warn("frame.failed", { frame: ctx.url.pathname, status: response.status });
			return frameError(`${response.status} ${response.statusText}`);
		}

		if (!response.body) return response;

		return new Response(endWithMarkerOnFailure(response.body, ctx.url.pathname), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};
}

/**
 * Passes `body` through chunk for chunk, so the renderer still inlines the fragment's first
 * chunk in place, and closes it with the failure marker when reading it errors.
 */
function endWithMarkerOnFailure(body: ReadableStream<Uint8Array>, frame: string) {
	let reader = body.getReader();
	let encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				let { done, value } = await reader.read();
				if (done) return controller.close();
				controller.enqueue(value);
			} catch (error) {
				currentLog()?.fail(error, { render: { failed: true, frame } });
				controller.enqueue(encoder.encode(frameErrorHtml(errorMessage(error))));
				controller.close();
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
}

/** A thrown value's message, which can be any value a fragment threw. */
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** The marker as a successful HTML answer, so the renderer inlines it into the frame. */
function frameError(reason: string): Response {
	return new Response(frameErrorHtml(reason), {
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

/** The marker a failed frame renders in place of its content. */
function frameErrorHtml(reason: string): string {
	return `<pre>Frame error: ${escapeHtml(reason.trim())}</pre>`;
}

/** Escapes a failure reason, which can carry an arbitrary thrown message, for text content. */
function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
