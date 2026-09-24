/**
 * Turns a well-known document into a `Response` with the headers every such answer
 * shares: its media type, a cache policy, an `ETag`, CORS where the format requires
 * it, and a 304 for a client whose copy is current.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PolicyOptions } from "@sdxc/http/cache";

import { conditional, etag, policy } from "@sdxc/http/cache";

import type { WellKnownFormat } from "./format.js";

/** The cache policy a well-known document gets unless the caller states one. */
const DEFAULT_CACHE: PolicyOptions = { visibility: "public", maxAge: "1 hour" };

/** How a document is answered. */
export interface RespondOptions {
	/** Enables a 304 when the request's `If-None-Match` still matches, and an empty body for `HEAD`. */
	request?: Request;
	/** @default { visibility: "public", maxAge: "1 hour" } */
	cache?: PolicyOptions;
	/** Extra headers, applied last so they override the defaults. */
	headers?: HeadersInit;
}

/**
 * The document as a `Response`: its media type, a `Cache-Control` from `policy()`, an
 * `ETag` from `etag()` over the serialized body, CORS where the format requires it, and a
 * 304 through `conditional()` when `request` is given.
 *
 * @param format - The document's format.
 * @param document - The document to serve.
 * @param options - The request, the cache policy and extra headers.
 * @template Document - The format's document type.
 * @example
 * return respond(openIdConfiguration, WELL_KNOWN, { request: ctx.request });
 */
export async function respond<Document>(
	format: WellKnownFormat<Document>,
	document: Document,
	options: RespondOptions = {},
): Promise<Response> {
	let body = format.stringify(document);
	let headers = new Headers({
		"Content-Type": format.mediaType,
		"Cache-Control": policy(options.cache ?? DEFAULT_CACHE).toString(),
	});

	let tag = await etag(body);
	if (tag.status === "success") headers.set("ETag", tag.data);
	if (format.cors) headers.set("Access-Control-Allow-Origin", "*");

	for (let [name, value] of new Headers(options.headers)) headers.set(name, value);

	let request = options.request;
	let isHead = request?.method.toUpperCase() === "HEAD";
	let response = new Response(isHead ? null : body, { status: 200, headers });
	if (request === undefined) return response;
	return await conditional(request, response);
}
