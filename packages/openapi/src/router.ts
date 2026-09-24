/**
 * A fetch-router handler that serves a document as JSON or YAML. The document is built on
 * the first request and reused, which keeps assembly out of a Worker's global scope, and
 * each representation carries a strong `ETag` so a client revalidates with a `304`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { RequestHandler } from "remix/router";

import { problem } from "@sdxc/problem";
import { Accept, IfNoneMatch } from "remix/headers";

import type { OpenAPIBuildError } from "./errors.js";
import type { OpenAPI } from "./types.js";

import { MEDIA_TYPE_JSON, MEDIA_TYPE_YAML, stringify } from "./serialize.js";

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

/** What the first request produced: both representations, or the problem to answer with. */
type Served =
	| { ok: true; json: Representation; yaml: Representation }
	| { ok: false; title: string; detail: string };

/**
 * Serves the document: JSON by default, YAML for `?format=yaml` or an `Accept` preferring
 * `application/yaml`. A build or serialization failure answers `500` with a problem
 * document, and the same outcome is reused for every later request.
 *
 * @param build - Assembles the document; called once, on the first request.
 * @param options - The `Cache-Control` both representations carry.
 * @example router.get(routes.openapi, openapiHandler(() => buildApiDocument().build()));
 */
export function openapiHandler(
	build: () => Result<OpenAPI.Document, OpenAPIBuildError>,
	options: ServeOptions = {},
): RequestHandler {
	let cacheControl = options.cacheControl ?? "public, max-age=300";
	let served: Promise<Served> | undefined;

	return async ({ request }) => {
		served ??= serve(build);
		let outcome = await served;
		if (!outcome.ok) {
			return problem({ status: 500, title: outcome.title, detail: outcome.detail });
		}

		let format = negotiate(request);
		let representation = outcome[format];
		let headers = new Headers({
			"Cache-Control": cacheControl,
			ETag: representation.etag,
			Vary: "Accept",
		});

		let ifNoneMatch = IfNoneMatch.from(request.headers.get("If-None-Match"));
		if (ifNoneMatch.matches(representation.etag) || ifNoneMatch.has(`W/${representation.etag}`)) {
			return new Response(null, { status: 304, headers });
		}

		headers.set("Content-Type", format === "yaml" ? MEDIA_TYPE_YAML : MEDIA_TYPE_JSON);
		return new Response(representation.body, { headers });
	};
}

/** Picks the representation: the `format` query parameter wins, then `Accept`, then JSON. */
function negotiate(request: Request): "json" | "yaml" {
	let format = new URL(request.url).searchParams.get("format");
	if (format === "yaml" || format === "json") return format;
	let preferred = Accept.from(request.headers.get("Accept")).getPreferred([
		MEDIA_TYPE_JSON,
		MEDIA_TYPE_YAML,
	]);
	return preferred === MEDIA_TYPE_YAML ? "yaml" : "json";
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
		let error =
			json.status === "failure" ? json.error : yaml.status === "failure" ? yaml.error : null;
		return {
			ok: false,
			title: "The OpenAPI document failed to serialize",
			detail: error?.message ?? "",
		};
	}
	return {
		ok: true,
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
