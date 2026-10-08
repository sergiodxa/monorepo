/**
 * Serving ActivityPub documents: telling an AS2 client from a browser on a URL that has
 * both representations, and answering with the media type, cache headers and status a
 * remote server expects, including `410` for something deleted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PolicyOptions } from "@sdxc/http/cache";

import { conditional, etag, policy, vary } from "@sdxc/http/cache";
import { accepts } from "@sdxc/http/negotiate";

import type { ActivityPub } from "./lib/types.js";

import { ACTIVITY_CONTENT_TYPE, ACTIVITY_JSON, LD_JSON } from "./lib/constants.js";
import { stringify } from "./lib/stringify.js";

/**
 * The cache policy a document gets unless the caller states one: short enough that an
 * edit reaches a refetching server within minutes.
 */
const DEFAULT_CACHE: PolicyOptions = { visibility: "public", maxAge: "5 minutes" };

/**
 * The candidates `wantsActivity` negotiates between. HTML is first, so a wildcard or a
 * missing `Accept` resolves to the page a browser or crawler expects.
 */
const NEGOTIATED_TYPES = ["text/html", ACTIVITY_JSON, LD_JSON];

/** How a document is answered. */
export interface RespondOptions {
	/** Enables a 304 when `If-None-Match` still matches, and an empty body for `HEAD`. */
	request?: Request;
	/** Adds `Vary: Accept`, which a URL that also serves HTML needs so caches keep both. */
	vary?: boolean;
	/** @default { visibility: "public", maxAge: "5 minutes" } */
	cache?: PolicyOptions;
	/** Extra headers, applied last so they override the defaults. */
	headers?: HeadersInit;
	/** @default 200, or 410 for a Tombstone */
	status?: number;
}

/**
 * Whether a request asks for the ActivityStreams representation: `true` only when
 * `application/activity+json` or `application/ld+json` is preferred over `text/html`.
 * A browser's wildcard and a request without `Accept` read as HTML.
 *
 * @param request - The incoming request.
 * @example
 * if (wantsActivity(request)) return respond(article, { request, vary: true });
 */
export function wantsActivity(request: Request): boolean {
	let preferred = accepts(request).preferred(...NEGOTIATED_TYPES);
	return preferred === ACTIVITY_JSON || preferred === LD_JSON;
}

/**
 * The document as a `Response`: `application/activity+json; charset=utf-8`, a
 * `Cache-Control` from `policy()`, an `ETag` over the body, `Vary: Accept` when asked,
 * and a 304 through `conditional()` when `request` is given. A `Tombstone` answers
 * `410`, which is how a refetching server learns the object was deleted.
 *
 * @param document - Any document, parsed or authored.
 * @param options - The request, `Vary`, the cache policy, extra headers and the status.
 * @example
 * return respond(actor, { request: ctx.request, vary: true });
 */
export async function respond(
	document: ActivityPub.Draft<ActivityPub.Document>,
	options: RespondOptions = {},
): Promise<Response> {
	let body = stringify(document);
	let headers = new Headers({
		"Content-Type": ACTIVITY_CONTENT_TYPE,
		"Cache-Control": policy(options.cache ?? DEFAULT_CACHE).toString(),
	});

	let tag = await etag(body);
	if (tag.status === "success") headers.set("ETag", tag.data);
	if (options.vary) vary(headers, "Accept");

	for (let [name, value] of new Headers(options.headers)) headers.set(name, value);

	let status = options.status ?? (document.type === "Tombstone" ? 410 : 200);
	let request = options.request;
	let isHead = request?.method.toUpperCase() === "HEAD";
	let response = new Response(isHead ? null : body, { status, headers });
	if (request === undefined) return response;
	return await conditional(request, response);
}
