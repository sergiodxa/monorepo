/**
 * Writes problem documents: the JSON text and the `Response` that carries it,
 * with RFC 9457's defaults applied so a status alone produces a valid document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ProblemOptions } from "./types.js";

import { statusPhrase } from "./status-phrase.js";

/** The registered media type of an RFC 9457 JSON problem document. */
export const PROBLEM_MEDIA_TYPE = "application/problem+json";

/** The `type` of a problem whose status code alone describes it. */
export const ABOUT_BLANK = "about:blank";

/**
 * Serializes a problem to its JSON text. Extension members are written first and the
 * standard members after them, so an extension named like a standard member never
 * replaces it; `null` or omitted `detail` and `instance` are left out.
 *
 * @param options - The problem to write; a parsed `Problem` is accepted as-is.
 * @returns The document's JSON text.
 * @example stringify({ status: 404 }); // '{"type":"about:blank","title":"Not Found","status":404}'
 */
export function stringify(options: ProblemOptions<object>): string {
	let body: Record<string, unknown> = {
		...options.extensions,
		type: options.type ?? ABOUT_BLANK,
		title: options.title ?? statusPhrase(options.status),
		status: options.status,
	};
	if (options.detail != null) body.detail = options.detail;
	else delete body.detail;
	if (options.instance != null) body.instance = options.instance;
	else delete body.instance;

	return JSON.stringify(body);
}

/**
 * Builds the `Response` for a problem, with the status line and the body's `status`
 * set from the same value and `Content-Type` declaring the problem media type.
 *
 * @param options - The problem to answer with.
 * @param init - Extra headers, such as `Retry-After`, merged under the content type.
 * @returns A response ready to return from a handler.
 * @example return problem({ status: 404 });
 * @example return problem({ status: 429, detail: "Try again in a minute." }, { headers: { "Retry-After": "60" } });
 */
export function problem(options: ProblemOptions<object>, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", PROBLEM_MEDIA_TYPE);

	return new Response(stringify(options), { ...init, status: options.status, headers });
}
