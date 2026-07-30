/**
 * Answering conditional requests: when the validators a client sends back still
 * describe the response about to be sent, the body is dropped and a `304` is
 * returned instead, carrying only the headers a `304` is allowed to carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IfNoneMatch } from "remix/headers";

import * as StatusCode from "../status-code";

import { parseHttpDate } from "./http-date";
import { ifModifiedSince, isModifiedSince } from "./if-modified-since";

/**
 * Methods a `304` may answer. A conditional header on any other method is a
 * precondition for a write, which `precondition()` handles instead.
 */
const CONDITIONAL_METHODS = new Set(["GET", "HEAD"]);

/**
 * The only headers a `304` carries, per the caching specification.
 *
 * `Vary` is on the list for a reason worth stating: a shared cache that receives
 * a `304` without it can no longer tell which negotiated variant was validated,
 * and may serve the stored one to a client that asked for something else.
 */
const NOT_MODIFIED_HEADERS = [
	"Cache-Control",
	"Content-Location",
	"Date",
	"ETag",
	"Expires",
	"Vary",
];

/**
 * The same entity tag written with the other strength.
 *
 * Weak comparison ignores the `W/` prefix, so a tag matches its counterpart; the
 * two forms are compared rather than the prefix stripped, so the framework's own
 * quoting and wildcard handling stays in charge of the match.
 */
function counterpart(tag: string): string {
	return tag.startsWith("W/") ? tag.slice(2) : `W/${tag}`;
}

/**
 * Whether the client's `If-None-Match` covers the response's own `ETag`, under
 * the weak comparison the specification defines for this header.
 *
 * A `*` matches because a representation exists at all; a response with no `ETag`
 * of its own can never match a listed tag.
 */
function matchesEtag(header: string, tag: string | null): boolean {
	let ifNoneMatch = IfNoneMatch.from(header);

	if (ifNoneMatch.matches("*")) return true;
	if (tag === null) return false;

	return ifNoneMatch.matches(tag) || ifNoneMatch.matches(counterpart(tag));
}

/**
 * Whether the copy the client already holds is still current.
 *
 * `If-None-Match` decides on its own whenever it is present, and
 * `If-Modified-Since` is consulted only in its absence, which is the precedence
 * the specification sets: an entity tag is the stronger validator of the two.
 */
function isCurrent(request: Request, response: Response): boolean {
	let ifNoneMatch = request.headers.get("If-None-Match");
	if (ifNoneMatch !== null) return matchesEtag(ifNoneMatch, response.headers.get("ETag"));

	let since = ifModifiedSince(request.headers);
	if (since === null) return false;

	let modifiedAt = parseHttpDate(response.headers.get("Last-Modified"));
	if (modifiedAt === null) return false;

	return !isModifiedSince(modifiedAt, since);
}

/**
 * Builds the `304` for a response whose body the client already has.
 *
 * The original body is cancelled rather than left dangling, so a response piped
 * from an upstream request releases its connection instead of waiting to be
 * garbage collected.
 */
async function notModified(response: Response): Promise<Response> {
	let headers = new Headers();

	for (let name of NOT_MODIFIED_HEADERS) {
		let value = response.headers.get(name);
		if (value !== null) headers.set(name, value);
	}

	if (response.body !== null && !response.body.locked) await response.body.cancel();

	return new Response(null, { ...StatusCode.NotModified, headers });
}

/**
 * Downgrades a response to a `304` when the request's validators still hold.
 *
 * Only a `GET` or `HEAD` answered with `200` is eligible; every other method and
 * status is returned untouched, so this can be applied at the end of a handler
 * without inspecting what the handler produced. Validators are read from the
 * response itself, meaning the caller decides what identifies the content by
 * setting `ETag` or `Last-Modified` on it.
 *
 * This is a separate saving from an edge cache: the cache decides whether the
 * handler runs, while a validator decides whether a body crosses the network.
 *
 * @param request - The incoming request, carrying the client's validators.
 * @param response - The response the handler produced.
 * @returns A `304` with no body, or the original response unchanged.
 *
 * @example
 * return await conditional(request, html(body, { headers }));
 * @example
 * let response = await conditional(request, json(payload, { headers }));
 * response.status; // 304 when the client's ETag still matches
 */
export async function conditional(request: Request, response: Response): Promise<Response> {
	if (!CONDITIONAL_METHODS.has(request.method.toUpperCase())) return response;
	if (response.status !== StatusCode.Ok.status) return response;
	if (!isCurrent(request, response)) return response;

	return await notModified(response);
}
