/**
 * Webmention endpoint discovery: the `Link` header first, then the first `<link>` or
 * `<a>` with `rel=webmention` in document order, resolved against the URL the page was
 * served from after redirects. Also the values a site advertises its own endpoint with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { addressable, release } from "@sdxc/distill/retrieve";
import { parseDocument } from "@sdxc/html/document";
import { parseLinkHeader } from "@sdxc/pagination";
import { failure, isFailure, success } from "@sdxc/result";

import type { Bounds } from "./lib/fetch.js";

import { essenceOf, fetchBounded, isHTML, readBody, transientStatus } from "./lib/fetch.js";
import { absolute, resolve } from "./lib/urls.js";

import { WebmentionFetchError } from "./index.js";

/** Groups the discovery types under a single import surface. */
export namespace Discover {
	/** What fetching a target may spend, and the name it asks under. */
	export interface Options extends Bounds {}

	/** A site's own endpoint, as a `Link` header value and as `<link>` attributes. */
	export interface Advertisement {
		header: string;
		link: { rel: "webmention"; href: string };
	}
}

/** The relation type naming a Webmention endpoint. */
const REL = "webmention";

/**
 * The endpoint a response advertises. A `Link` header decides it when one names the
 * relation; otherwise an HTML body is read, and the first `<link>` or `<a>` whose `rel`
 * holds the `webmention` token wins. An empty `href` names the page itself.
 *
 * @param response - The target's response; its body is read only when no header matched
 * @param finalUrl - The URL the response came from, after redirects
 * @returns The absolute endpoint, query string kept, or `null` when none is advertised
 */
export async function endpointOf(response: Response, finalUrl: string): Promise<URL | null> {
	let header = fromHeader(response.headers, finalUrl);
	if (header !== null) {
		release(response.body);
		return header;
	}
	if (!isHTML(essenceOf(response))) {
		release(response.body);
		return null;
	}
	return fromMarkup(await response.text(), finalUrl);
}

/**
 * Fetches `target` under bounds and discovers its endpoint. An endpoint on a host
 * `addressable` refuses is a failure, which is the request forgery a page naming an
 * internal address as its endpoint would otherwise get a sender to make.
 *
 * @param target - The page being mentioned
 * @param options - The user agent to ask under, and the bounds
 * @returns The endpoint, `null` when the page advertises none or answers 4xx, or why the fetch failed
 */
export async function discover(
	target: string | URL,
	options: Discover.Options,
): Promise<Result<URL | null, WebmentionFetchError>> {
	let url = typeof target === "string" ? absolute(target) : target;
	if (url === null) {
		return failure(new WebmentionFetchError(`Refused ${String(target)}: it is not a URL`, false));
	}

	let fetched = await fetchBounded(url, options);
	if (isFailure(fetched)) return fetched;

	let { response, url: finalUrl } = fetched.data;
	let transient = transientStatus(fetched.data);
	if (transient !== null) {
		release(response.body);
		return failure(transient);
	}

	let endpoint = fromHeader(response.headers, finalUrl);
	if (endpoint !== null) {
		release(response.body);
	} else if (response.ok && isHTML(essenceOf(response))) {
		let body = await readBody(fetched.data, options);
		if (isFailure(body)) return body;
		endpoint = fromMarkup(body.data, finalUrl);
	} else {
		release(response.body);
	}

	if (endpoint === null) return success(null);

	let checked = addressable(endpoint.href);
	if (isFailure(checked)) return failure(new WebmentionFetchError(checked.error.message, false));
	return success(endpoint);
}

/**
 * The `Link` header value and the `<link>` attributes that advertise an endpoint. A URL
 * is written absolute; a string is written as given, so a relative path stays relative.
 *
 * @param endpoint - This site's Webmention endpoint
 */
export function advertise(endpoint: string | URL): Discover.Advertisement {
	let href = typeof endpoint === "string" ? endpoint : endpoint.href;
	return { header: `<${href}>; rel="${REL}"`, link: { rel: REL, href } };
}

/** The first `Link` value naming the relation, resolved; header names match in any case. */
function fromHeader(headers: Headers, finalUrl: string): URL | null {
	for (let link of parseLinkHeader(headers.get("link"))) {
		if (!link.rels.includes(REL)) continue;
		let url = resolve(link.target, finalUrl);
		if (url !== null) return url;
	}
	return null;
}

/**
 * The first `<link>` or `<a>` in document order whose `rel` holds the token and which
 * has an `href`. Markup inside comments and escaped text never reaches the tree.
 */
function fromMarkup(source: string, finalUrl: string): URL | null {
	let document = parseDocument(source);
	if (isFailure(document)) return null;

	for (let element of Array.from(document.data.querySelectorAll("link[href], a[href]"))) {
		let rels = (element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/u);
		if (!rels.includes(REL)) continue;
		let url = resolve(element.getAttribute("href") ?? "", finalUrl);
		if (url !== null) return url;
	}
	return null;
}
