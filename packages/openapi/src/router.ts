/**
 * Fetch-router pieces: a handler that serves a document as JSON or YAML, built on the
 * first request and revalidated through a strong `ETag`, and middleware announcing a
 * deprecated operation's retirement on every response its route answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";

import { setDeprecation } from "@sdxc/http/deprecation";
import { iife } from "@sdxc/iife";
import { problem } from "@sdxc/problem";
import { Accept, IfNoneMatch } from "remix/headers";

import type { OpenAPIBuildError } from "./errors.js";
import type { Operation } from "./operation.js";
import type { OpenAPI } from "./types.js";

import {
	MEDIA_TYPE_JSON,
	MEDIA_TYPE_OPENAPI_JSON,
	MEDIA_TYPE_OPENAPI_YAML,
	MEDIA_TYPE_YAML,
	stringify,
} from "./serialize.js";

/** How the handler answers. */
export interface ServeOptions {
	/** @default "public, max-age=300" */
	cacheControl?: string;
}

/** One serialized representation, ready to answer with. */
interface Representation {
	body: string;
	etag: string;
}

/**
 * The media types a document is served as, in the order a wildcard `Accept` picks them, so a
 * wildcard and a missing header both get the registered OpenAPI JSON type.
 */
const CANDIDATES = [
	{ mediaType: MEDIA_TYPE_OPENAPI_JSON, format: "json", registered: true },
	{ mediaType: MEDIA_TYPE_OPENAPI_YAML, format: "yaml", registered: true },
	{ mediaType: MEDIA_TYPE_JSON, format: "json", registered: false },
	{ mediaType: MEDIA_TYPE_YAML, format: "yaml", registered: false },
] as const;

/** One media type the handler answers with. */
type Candidate = (typeof CANDIDATES)[number];

/**
 * What the first request produced: both representations and the document's OpenAPI version,
 * or the problem to answer with.
 */
type Served =
	| { ok: true; version: string; json: Representation; yaml: Representation }
	| { ok: false; title: string; detail: string };

/**
 * Serves the document as `application/openapi+json` or `+yaml` with a `version` parameter,
 * or as `application/json` or `application/yaml` to a client asking for those by `Accept`;
 * `?format=` fixes the syntax. A build failure answers `500` with a problem document.
 *
 * @param build - Assembles the document; called once, on the first request.
 * @param options - The `Cache-Control` both representations carry.
 * @example router.get(routes.openapi, openapiHandler(() => buildApiDocument().build()));
 */
export function openapiHandler(
	build: () => Result<OpenAPI.Document, OpenAPIBuildError>,
	options: ServeOptions = {},
): RequestHandler<RequestContext<any, any>> {
	let cacheControl = options.cacheControl ?? "public, max-age=300";
	let served: Promise<Served> | undefined;

	return async ({ request }) => {
		served ??= serve(build);
		let outcome = await served;
		if (!outcome.ok) {
			return problem({ status: 500, title: outcome.title, detail: outcome.detail });
		}

		let candidate = negotiate(request);
		let representation = outcome[candidate.format];
		let headers = new Headers({
			"Cache-Control": cacheControl,
			ETag: representation.etag,
			Vary: "Accept",
		});

		let ifNoneMatch = IfNoneMatch.from(request.headers.get("If-None-Match"));
		if (ifNoneMatch.matches(representation.etag) || ifNoneMatch.has(`W/${representation.etag}`)) {
			return new Response(null, { status: 304, headers });
		}

		headers.set(
			"Content-Type",
			candidate.registered
				? `${candidate.mediaType}; version=${outcome.version}`
				: candidate.mediaType,
		);
		return new Response(representation.body, { headers });
	};
}

/**
 * Writes the RFC 9745 `Deprecation` and RFC 8594 `Sunset` fields, and their links, from
 * the notice an operation declares as `deprecated`, onto whatever its route answers. An
 * operation declaring no notice passes responses through; building the document rejects
 * a notice the fields cannot carry, so a drift test catches it before it ships.
 *
 * @param operation - The operation the route serves.
 * @returns Middleware for the route's own chain.
 * @example createAction(routes.api.monitors.show, { middleware: [deprecationHeaders(MONITOR_SHOW)], handler });
 */
export function deprecationHeaders(operation: Operation): Middleware {
	let notice = operation.spec.deprecated;
	return async (_ctx, next) => {
		let response = await next();
		if (typeof notice !== "object") return response;

		let headers = new Headers(response.headers);
		if (setDeprecation(headers, notice).status === "failure") return response;
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * Picks the media type: `?format=json|yaml` narrows the candidates to that syntax, then
 * `Accept` chooses among them. An absent header, or one naming none of them, gets the first
 * remaining candidate, so a document always answers and never `406`.
 */
function negotiate(request: Request): Candidate {
	let format = new URL(request.url).searchParams.get("format");
	let candidates = CANDIDATES.filter(
		(candidate) => (format !== "json" && format !== "yaml") || candidate.format === format,
	);
	let preferred = Accept.from(request.headers.get("Accept")).getPreferred(
		candidates.map((candidate) => candidate.mediaType),
	);
	return (
		candidates.find((candidate) => candidate.mediaType === preferred) ??
		candidates[0] ??
		CANDIDATES[0]
	);
}

/** Builds the document once and serializes both representations. */
async function serve(build: () => Result<OpenAPI.Document, OpenAPIBuildError>): Promise<Served> {
	let built = build();
	if (built.status === "failure") {
		return {
			ok: false,
			title: "The OpenAPI document failed to build",
			detail: built.error.message,
		};
	}

	let json = stringify(built.data);
	let yaml = stringify(built.data, { format: "yaml" });
	if (json.status === "failure" || yaml.status === "failure") {
		let error = iife(() => {
			if (json.status === "failure") return json.error;
			if (yaml.status === "failure") return yaml.error;
			return null;
		});
		return {
			ok: false,
			title: "The OpenAPI document failed to serialize",
			detail: error?.message ?? "",
		};
	}
	return {
		ok: true,
		version: built.data.openapi,
		json: { body: json.data, etag: await etagOf(json.data) },
		yaml: { body: yaml.data, etag: await etagOf(yaml.data) },
	};
}

/** A strong entity tag over the serialized bytes: their SHA-256, hex-encoded. */
async function etagOf(body: string): Promise<string> {
	let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
	let hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `"${hex}"`;
}
