/**
 * Decorates every response with the policy a page is read under: a
 * Content-Security-Policy that starts from nothing and permits this origin, and the
 * headers that keep a referrer, a frame, a sniffed type and a device API out of it.
 *
 * It is the one item here whose value does not depend on anything else being right. A
 * sanitizer bug that lets a `<script>` through costs a console message, and one that lets
 * a pixel through costs a broken image and no request, so the policy is what every other
 * rule fails closed against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

/**
 * The policy every response is served under.
 *
 * `default-src 'none'` rather than `'self'`, so a fetch type nobody thought about fails
 * closed and permitting one is a deliberate edit here. `img-src 'self'` is the
 * load-bearing line: a publisher's image reaches a reader through this app's own media
 * route or not at all, so a tracking pixel that survives the sanitizer still makes no
 * request from the reader's browser.
 *
 * `style-src` carries `'unsafe-inline'` because this app's renderer mints the rules for a
 * page as it streams it and emits them as `<style>` elements in the document it is
 * building; a hash or a nonce is not available to a streamed render. What that would
 * otherwise re-permit — an injected `style` attribute placing a control over the app's own
 * or naming an unproxied `background-image` — is closed one layer up instead, where the
 * sanitizer's attribute allow-list names no `style` at all.
 *
 * `manifest-src 'self'` is spelled out because the document links a web app manifest, and
 * a browser will not keep a push subscription for a page whose manifest it could not read.
 */
const CONTENT_SECURITY_POLICY = [
	"default-src 'none'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self'",
	"font-src 'self'",
	"connect-src 'self'",
	"manifest-src 'self'",
	"media-src 'none'",
	"frame-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	"base-uri 'none'",
	"object-src 'none'",
].join("; ");

/**
 * The rest of the header set, each a promise the document makes about itself.
 *
 * `no-referrer` costs small publishers the signal that tells them readers arrive from a
 * feed reader at all, and it goes anyway: the alternative is telling a publisher's server
 * which of this app's pages a reader was standing on. `browsing-topics=()` refuses the
 * browser's own advertising-topics API, which is the one measurement here that needs no
 * publisher's cooperation.
 */
const SECURITY_HEADERS: Record<string, string> = {
	"referrer-policy": "no-referrer",
	"x-content-type-options": "nosniff",
	"strict-transport-security": "max-age=63072000; includeSubDomains; preload",
	"cross-origin-opener-policy": "same-origin",
	"cross-origin-resource-policy": "same-origin",
	"permissions-policy":
		"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
};

/**
 * Applies the policy to a response the renderer has already produced, leaving a header the
 * response set for itself exactly as it set it, so a route that answers with a stricter
 * value of its own keeps it.
 *
 * @param headers - The response's own headers, decorated in place.
 */
export function applySecurityHeaders(headers: Headers): void {
	if (!headers.has("content-security-policy")) {
		headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
	}

	for (let [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!headers.has(name)) headers.set(name, value);
	}
}

/**
 * Publishes the policy on every response this app sends. It sits immediately before the
 * renderer in the chain, so the response it decorates is the one the renderer produced and
 * no surface can be added that quietly escapes the policy.
 */
export let securityHeaders: Middleware = async (_, next) => {
	let response = await next();

	let headers = new Headers(response.headers);
	applySecurityHeaders(headers);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

export default securityHeaders;
