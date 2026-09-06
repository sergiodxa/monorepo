/**
 * Builds the conditional request a poller sends and reads the validators the
 * answer carries, which is what lets an unchanged feed cost a 304 instead of a
 * download and a parse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Feed } from "../index.js";

/** The validators a response reported, absent when it carried none. */
export interface Validators {
	etag?: string;
	lastModified?: string;
}

/**
 * Builds the request headers, adding the stored validators as preconditions.
 *
 * No cache directive is set: asking for a fresh copy is exactly what would stop
 * the origin from answering 304, which is the whole point of sending these.
 *
 * @param options - The stored validators and any caller-supplied headers
 * @returns The headers to send
 */
export function buildConditionalHeaders(options: Feed.FetchOptions): Headers {
	let headers = new Headers(options.headers);

	if (options.etag) headers.set("if-none-match", options.etag);
	if (options.lastModified) headers.set("if-modified-since", options.lastModified);

	return headers;
}

/**
 * Reads the validators to store against the next request.
 *
 * A 304 is allowed to omit them, so the caller's own are carried forward rather
 * than dropped, which would turn the next poll into an unconditional request.
 *
 * @param response - The response to read
 * @param options - The validators the caller already held
 * @returns The validators to store
 */
export function readValidators(response: Response, options: Feed.FetchOptions): Validators {
	let validators: Validators = {};

	let etag = response.headers.get("etag") ?? options.etag;
	let lastModified = response.headers.get("last-modified") ?? options.lastModified;

	if (etag) validators.etag = etag;
	if (lastModified) validators.lastModified = lastModified;

	return validators;
}
