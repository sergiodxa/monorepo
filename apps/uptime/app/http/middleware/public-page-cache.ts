/**
 * Lets the viewer's own browser keep a public page for five minutes, so a link prefetch answers
 * the navigation that follows it instead of the page rendering twice. Only a fresh `200` HTML
 * page is stored; anything with its own cache policy, a cookie, or another status passes through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Policies, vary } from "@sdxc/http/cache";

/** Bounds how long a published copy edit, or a header CTA after signing in elsewhere, can lag. */
const MAX_AGE = "5 minutes";

/**
 * The request headers a public page's markup depends on: `Cookie` carries the session behind the
 * signed-in header CTA and the chosen `language`, and `Accept-Language` picks the language of a
 * visitor with neither. Signing in or out, or switching language, changes them and misses.
 */
const VARY_ON = ["Cookie", "Accept-Language"];

/**
 * Stamps `Cache-Control: private, max-age=300` on a public page and merges `Cookie` and
 * `Accept-Language` into its `Vary`. Map it in front of a public page's controller, inside the
 * security headers, so the stored HTML and the CSP carrying its nonce travel as one response.
 */
export default function publicPageCache(): Middleware {
	return async (context, next) => {
		let response = await next();
		if (!isStorable(context.request, response)) return response;

		let headers = new Headers(response.headers);
		headers.set("Cache-Control", Policies.private({ maxAge: MAX_AGE }).toString());
		vary(headers, VARY_ON);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * Whether the browser may keep the response: a `GET` answered by a `200` HTML page that states
 * no cache policy of its own and sets no cookie. A cookie changes the request the next visit
 * sends, so a stored copy keyed on the old one would only ever be served stale.
 */
function isStorable(request: Request, response: Response): boolean {
	if (request.method !== "GET") return false;
	if (response.status !== 200) return false;
	if (response.headers.has("Cache-Control")) return false;
	if (response.headers.has("Set-Cookie")) return false;

	let contentType = response.headers.get("Content-Type") ?? "";
	return contentType.split(";", 1)[0]?.trim().toLowerCase() === "text/html";
}
