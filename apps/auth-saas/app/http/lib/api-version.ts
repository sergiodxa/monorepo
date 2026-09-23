/**
 * `X-API-Version` resolution: a request names a published date or none, and every
 * response echoes back the one that actually served it — the mechanism a later pass
 * registers a second published date against, once a route's shape actually changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { managementProblem } from "./problem";

/** The header both a request and a response name a version through. */
export const API_VERSION_HEADER = "X-API-Version";

/**
 * Every version this API has ever published, oldest first — the list a request
 * naming an unpublished date is refused alongside. A request naming none is served
 * the first entry, so an integration keeps its shape until its author moves it.
 */
export const PUBLISHED_API_VERSIONS = ["2026-09-21"] as const;

export type PublishedApiVersion = (typeof PUBLISHED_API_VERSIONS)[number];

export type ResolveApiVersionResult =
	| { ok: true; version: PublishedApiVersion }
	| { ok: false; published: readonly PublishedApiVersion[] };

/**
 * Resolves the version a request named in `X-API-Version`, defaulting to the oldest
 * published one when the header is absent.
 *
 * @param request - The incoming request.
 * @returns The resolved version, or every version this API does publish when the
 * given one is not among them.
 * @example
 * let resolved = resolveApiVersion(ctx.request);
 * if (!resolved.ok) return unpublishedApiVersion(resolved.published);
 */
export function resolveApiVersion(request: Request): ResolveApiVersionResult {
	let requested = request.headers.get(API_VERSION_HEADER);
	if (requested === null) return { ok: true, version: PUBLISHED_API_VERSIONS[0] };

	if ((PUBLISHED_API_VERSIONS as readonly string[]).includes(requested)) {
		return { ok: true, version: requested as PublishedApiVersion };
	}

	return { ok: false, published: PUBLISHED_API_VERSIONS };
}

/**
 * Echoes the version that served a response.
 *
 * @param response - The response about to be sent.
 * @param version - The version {@link resolveApiVersion} resolved for this request.
 * @returns The same response, carrying `X-API-Version`.
 * @example
 * return applyApiVersionHeader(await next(), resolved.version);
 */
export function applyApiVersionHeader(response: Response, version: PublishedApiVersion): Response {
	try {
		response.headers.set(API_VERSION_HEADER, version);
		return response;
	} catch {
		let headers = new Headers(response.headers);
		headers.set(API_VERSION_HEADER, version);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

/**
 * The router middleware wrapping resolution and echoing into one step: refuses an
 * unpublished version with a `problem+json` body naming every version this API does
 * publish, and otherwise echoes the resolved version onto whatever the route answers.
 *
 * @returns The middleware, for the management router's global chain.
 * @example
 * createRouter({ middleware: [apiVersioning()] });
 */
export function apiVersioning(): Middleware {
	return async (ctx, next) => {
		let resolved = resolveApiVersion(ctx.request);

		if (!resolved.ok) {
			return managementProblem("unsupportedApiVersion", {
				detail: `Published versions: ${resolved.published.join(", ")}`,
			});
		}

		let response = await next();
		return applyApiVersionHeader(response, resolved.version);
	};
}
