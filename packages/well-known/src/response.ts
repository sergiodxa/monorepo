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
	/**
	 * Rewrites the serialized body before its `ETag` is computed, so a body wrapped in a
	 * signature (a cleartext-signed security.txt) is what the tag and a 304 describe.
	 */
	transform?: (body: string) => string | Promise<string>;
	/**
	 * Runs over the full 200 response before a 304 or `HEAD` drops its body, so a message
	 * signature can cover the body's digest, as a signed key directory does.
	 */
	sign?: (response: Response, request: Request | undefined) => Promise<Response>;
}

/**
 * The document as a `Response`: its media type, a `Cache-Control` from `policy()`, an
 * `ETag` from `etag()` over the serialized body, CORS and the format's own headers, and a
 * 304 through `conditional()` when `request` is given, after any `sign` step.
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
	if (options.transform) body = await options.transform(body);
	let headers = new Headers({
		"Content-Type": format.mediaType,
		"Cache-Control": policy(options.cache ?? DEFAULT_CACHE).toString(),
	});

	let tag = await etag(body);
	if (tag.status === "success") headers.set("ETag", tag.data);
	if (format.cors) headers.set("Access-Control-Allow-Origin", "*");
	for (let [name, value] of Object.entries(format.headers ?? {})) headers.set(name, value);

	for (let [name, value] of new Headers(options.headers)) headers.set(name, value);

	let request = options.request;
	let response = new Response(body, { status: 200, headers });
	if (options.sign) response = await options.sign(response, request);
	if (request?.method.toUpperCase() === "HEAD") response = new Response(null, response);
	if (request === undefined) return response;
	return await conditional(request, response);
}
