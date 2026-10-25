/**
 * `X-API-Version` resolution: a request names a published date or none, and every
 * response echoes back the one that served it, with the RFC 9745 `Deprecation` and
 * RFC 8594 `Sunset` fields once that date is retired.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeprecationNotice } from "@sdxc/http/deprecation";
import type { Middleware } from "remix/router";

import { setDeprecation } from "@sdxc/http/deprecation";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import { managementProblem } from "~/app/http/problem";

/** The header both a request and a response name a version through. */
export const API_VERSION_HEADER = "X-API-Version";

/**
 * Every version this API has ever published, oldest first — the list a request
 * naming an unpublished date is refused alongside. A request naming none is served
 * the first entry, so an integration keeps its shape until its author moves it.
 */
export const PUBLISHED_API_VERSIONS = ["2026-09-21"] as const;

export type PublishedApiVersion = (typeof PUBLISHED_API_VERSIONS)[number];

/**
 * The retirement of each deprecated version: every response it serves carries the
 * notice, so an integration still pinned to it learns when to move and when it stops
 * answering. A version absent here is current.
 *
 * @example { "2026-09-21": { deprecation: new Date("2027-01-01T00:00:00Z"), sunset: new Date("2027-07-01T00:00:00Z"), deprecationLink: "https://docs.example.com/changelog/2027-01-01" } }
 */
export const API_VERSION_DEPRECATIONS: Partial<Record<PublishedApiVersion, DeprecationNotice>> = {};

/** What {@link apiVersioning} announces beside the version it echoes. */
export interface ApiVersioningOptions {
	/** @default API_VERSION_DEPRECATIONS */
	deprecations?: Partial<Record<PublishedApiVersion, DeprecationNotice>>;
}

export type ResolveApiVersionResult =
	| { ok: true; version: PublishedApiVersion }
	| { ok: false; published: readonly PublishedApiVersion[] };

/**
 * Resolves the version a request named in `X-API-Version`, defaulting to the oldest
 * published one when the header is absent.
 *
 * @param request - The incoming request.
 * @returns The resolved version, or every version this API does publish when the given one is not among them.
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
 * Echoes the version that served a response, with its deprecation notice when it has
 * one. A notice the fields cannot carry, such as a sunset before its deprecation, is
 * logged and left off, so a misconfigured retirement never fails the request itself.
 *
 * @param response - The response about to be sent.
 * @param version - The version {@link resolveApiVersion} resolved for this request.
 * @param notice - The version's entry in {@link API_VERSION_DEPRECATIONS}, if any.
 * @returns A response carrying `X-API-Version`, plus `Deprecation`, `Sunset` and their links for a deprecated version.
 * @example
 * return applyApiVersionHeader(await next(), resolved.version, API_VERSION_DEPRECATIONS[resolved.version]);
 */
export function applyApiVersionHeader(
	response: Response,
	version: PublishedApiVersion,
	notice?: DeprecationNotice,
): Response {
	let headers = new Headers(response.headers);
	headers.set(API_VERSION_HEADER, version);

	if (notice !== undefined) {
		let written = setDeprecation(headers, notice);
		if (isFailure(written)) {
			currentLog()?.warn("api_version.deprecation_invalid", {
				version,
				error: written.error.message,
			});
		}
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

/**
 * The router middleware wrapping resolution and echoing into one step: refuses an
 * unpublished version with a `problem+json` body naming every version this API does
 * publish, and otherwise echoes the resolved version, and its deprecation notice, onto
 * whatever the route answers.
 *
 * @param options - The deprecations to announce; a test passes its own.
 * @returns The middleware, for the management router's global chain.
 * @example
 * createRouter({ middleware: [apiVersioning()] });
 */
export function apiVersioning(options: ApiVersioningOptions = {}): Middleware {
	let deprecations = options.deprecations ?? API_VERSION_DEPRECATIONS;
	return async (ctx, next) => {
		let resolved = resolveApiVersion(ctx.request);

		if (!resolved.ok) {
			return managementProblem("unsupportedApiVersion", {
				detail: `Published versions: ${resolved.published.join(", ")}`,
			});
		}

		let response = await next();
		return applyApiVersionHeader(response, resolved.version, deprecations[resolved.version]);
	};
}
