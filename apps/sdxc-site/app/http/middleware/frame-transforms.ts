/**
 * Marks every answer to a frame request `no-transform`, so the edge delivers frame markup
 * exactly as rendered. Cloudflare appends its analytics script to HTML it may transform, and
 * a frame renders that trailing script in place of the content it was asked for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

/** The header the frame runtime sends on every request it makes for a frame's content. */
const FRAME_REQUEST_HEADER = "X-Remix-Frame";

/**
 * Adds `no-transform` to the `Cache-Control` of a response to a frame request, keeping any
 * directives the handler set. Full page loads carry no frame header and keep the analytics
 * script the edge adds to them.
 */
export default function frameTransforms(): Middleware {
	return async (context, next) => {
		let response = await next();
		if (!context.request.headers.has(FRAME_REQUEST_HEADER)) return response;

		let cacheControl = response.headers.get("Cache-Control");
		if (cacheControl?.includes("no-transform")) return response;

		let headers = new Headers(response.headers);
		headers.set("Cache-Control", cacheControl ? `${cacheControl}, no-transform` : "no-transform");
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}
