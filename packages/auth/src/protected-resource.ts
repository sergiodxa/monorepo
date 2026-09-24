/**
 * The client side of RFC 9728: starting from nothing but an API's URL, or the `401` it
 * answered with, it reads the API's protected resource metadata and hands out the
 * `Issuer` for an authorization server the API names, so a client learns where to get a token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { ProtectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";
import { metadataUrl, parse } from "@sdxc/well-known/oauth-protected-resource";

import { AuthError, AuthErrorCode } from "./auth-error.js";
import { parse as parseChallenges } from "./bearer-challenge.js";
import { nonJsonMediaType } from "./content-type.js";
import { Issuer } from "./issuer.js";

/** How long a fetched metadata document stays in a shared cache. */
const DEFAULT_TTL: DurationInput = "1 hour";

/** Prefix every cache entry this class writes is stored under. */
const CACHE_PREFIX = "auth:protected-resource";

/** Matches the trailing slashes a URL identifier carries interchangeably. */
const TRAILING_SLASHES = /\/+$/;

/**
 * Reports whether two authorization server identifiers name the same server, reading
 * both as URLs so host case and a trailing slash carry no meaning.
 *
 * @param left - One identifier.
 * @param right - The other identifier.
 */
function sameServer(left: URL, right: URL): boolean {
	return left.href.replace(TRAILING_SLASHES, "") === right.href.replace(TRAILING_SLASHES, "");
}

/**
 * A failure to read a resource's metadata, under the code every discovery failure in
 * this package carries.
 *
 * @param message - What went wrong, for an operator reading a log.
 * @param cause - The underlying error.
 */
function discoveryFailed(message: string, cause?: unknown): AuthError {
	return new AuthError(message, { code: AuthErrorCode.DiscoveryFailed, cause });
}

/**
 * Fetches a metadata document as text, reporting a transport failure, a non-2xx answer
 * and a declared non-JSON media type alike as a discovery failure.
 *
 * @param url - Where the document is served.
 */
async function fetchDocument(url: URL): Promise<Result<string, AuthError>> {
	let answer = await wrap(() => fetch(url, { headers: { accept: "application/json" } }));
	if (isFailure(answer)) {
		return failure(discoveryFailed(`The request to ${url.href} did not complete.`, answer.error));
	}

	let response = answer.data;
	if (!response.ok) {
		return failure(discoveryFailed(`${url.href} answered with status ${response.status}.`));
	}

	let mediaType = nonJsonMediaType(response);
	if (mediaType !== null) {
		return failure(discoveryFailed(`${url.href} answered with ${mediaType} instead of JSON.`));
	}

	return success(await response.text());
}

/**
 * Reads a metadata document through the shared cache when there is one, so the fetch
 * is spent once per TTL across every isolate asking about the same resource.
 *
 * @param url - Where the document is served.
 * @param cache - The shared tier, or a factory for it.
 */
async function readDocument(
	url: URL,
	cache: Issuer.CacheSource | undefined,
): Promise<Result<string, AuthError>> {
	let store = typeof cache === "function" ? cache() : cache;
	if (store === undefined) return await fetchDocument(url);

	let stored = await store.fetch(
		`${CACHE_PREFIX}:${url.href}`,
		async () => {
			let fetched = await fetchDocument(url);
			if (isFailure(fetched)) throw fetched.error;
			return fetched.data;
		},
		{ ttl: DEFAULT_TTL },
	);
	if (isSuccess(stored)) return stored;

	let cause = stored.error.cause ?? stored.error;
	if (cause instanceof AuthError) return failure(cause);
	return failure(discoveryFailed(`The metadata at ${url.href} could not be read.`, cause));
}

/**
 * Reads an issuer's discovery document, so the issuer handed out is one whose
 * metadata is known to be readable and to name the server that was asked for.
 *
 * @param issuer - The issuer to read.
 */
async function readIssuer(issuer: Issuer): Promise<Result<Issuer, AuthError>> {
	let read = await wrap(() => issuer.metadata());
	if (isSuccess(read)) return success(issuer);
	if (read.error instanceof AuthError) return failure(read.error);
	return failure(discoveryFailed(`${issuer.url.href} could not be discovered.`, read.error));
}

/**
 * An API protected by OAuth, known through the RFC 9728 metadata it publishes. Every
 * document is held to the resource it was fetched for (§3.3), so a server cannot answer
 * for an API it is not.
 *
 * @example
 * let api = unwrap(await ProtectedResource.discover("https://api.example.com/v1"));
 * let issuer = unwrap(await api.issuer());
 * @example
 * let api = await ProtectedResource.fromChallenge(response, request.url);
 */
export class ProtectedResource {
	/**
	 * Fetches the metadata RFC 9728 §3.1 serves for a resource identifier and checks the
	 * document names that identifier.
	 *
	 * @param resource - The resource identifier, as the client knows it.
	 * @param options - The resource match rule and a shared cache.
	 * @returns The resource, or a `discovery_failed` error for a document that cannot be
	 *   fetched, is malformed, or names another resource.
	 * @example
	 * let api = await ProtectedResource.discover("https://api.example.com/v1");
	 */
	static async discover(
		resource: URL | string,
		options: ProtectedResource.DiscoverOptions = {},
	): Promise<Result<ProtectedResource, AuthError>> {
		return await ProtectedResource.#read(metadataUrl(resource), resource, options);
	}

	/**
	 * Follows the `resource_metadata` pointer on a `401` or `403` (§5.1) and checks the
	 * document names the URL that was requested (§3.3).
	 *
	 * @param response - The refusal, whose `WWW-Authenticate` header is read.
	 * @param requested - The URL the refused request was made to.
	 * @param options - The resource match rule and a shared cache.
	 * @returns The resource; `null` when no Bearer challenge carries a pointer, so the
	 *   caller falls back to configured values; `discovery_failed` for an unreadable header
	 *   or document, or one naming another resource.
	 * @example
	 * let api = await ProtectedResource.fromChallenge(response, url, { match: "prefix" });
	 */
	static async fromChallenge(
		response: Response,
		requested: URL | string,
		options: ProtectedResource.DiscoverOptions = {},
	): Promise<Result<ProtectedResource | null, AuthError>> {
		let header = response.headers.get("www-authenticate");
		if (header === null) return success(null);

		let challenges = parseChallenges(header);
		if (isFailure(challenges)) {
			return failure(
				discoveryFailed("The WWW-Authenticate header is unreadable.", challenges.error),
			);
		}

		let pointer = challenges.data.find((challenge) => challenge.resourceMetadata !== null);
		if (pointer?.resourceMetadata == null) return success(null);

		return await ProtectedResource.#read(pointer.resourceMetadata, requested, options);
	}

	/**
	 * The scopes a refusal's Bearer challenges ask for, so a client re-authorizes once for
	 * all of them after a `403` with `insufficient_scope`.
	 *
	 * @param response - The refusal.
	 * @returns Every scope named, deduplicated in header order; empty for a response with
	 *   no readable Bearer challenge.
	 */
	static requiredScopes(response: Response): string[] {
		let challenges = parseChallenges(response.headers.get("www-authenticate") ?? "");
		if (isFailure(challenges)) return [];
		return [...new Set(challenges.data.flatMap((challenge) => challenge.scope))];
	}

	/**
	 * Fetches and checks one metadata document.
	 *
	 * @param url - Where the document is served.
	 * @param resource - The identifier the document must name.
	 * @param options - The match rule and the shared cache.
	 */
	static async #read(
		url: URL,
		resource: URL | string,
		options: ProtectedResource.DiscoverOptions,
	): Promise<Result<ProtectedResource, AuthError>> {
		let body = await readDocument(url, options.cache);
		if (isFailure(body)) return body;

		let metadata = parse(body.data, { resource, match: options.match });
		if (isFailure(metadata)) {
			return failure(discoveryFailed(`${url.href} published unusable metadata.`, metadata.error));
		}

		return success(new ProtectedResource(metadata.data));
	}

	/** The document the resource published, already held to the resource it was read for. */
	readonly metadata: ProtectedResourceMetadata<Record<string, unknown>>;

	/**
	 * Wraps metadata the app already holds; `discover` and `fromChallenge` are the way in
	 * for a fetched document, since they run the §3.3 check.
	 *
	 * @param metadata - The resource's metadata.
	 */
	constructor(metadata: ProtectedResourceMetadata<Record<string, unknown>>) {
		this.metadata = metadata;
	}

	/**
	 * The `Issuer` for one of the authorization servers the resource lists, read through
	 * its RFC 8414 metadata and, when that cannot be read, its OpenID Connect discovery
	 * document. A server the resource does not list is refused (§7.6).
	 *
	 * @param authorizationServer - The server to use, the first listed when omitted.
	 * @param options - The issuer's cache and the rest of its configuration.
	 * @returns The issuer with its metadata read; `issuer_mismatch` for an unlisted
	 *   server or a document naming another issuer, `endpoint_unsupported` for a resource
	 *   listing none, `discovery_failed` when neither document can be read.
	 * @example
	 * let issuer = await api.issuer(undefined, { cache });
	 */
	async issuer(
		authorizationServer?: URL | string,
		options: Omit<Issuer.Options, "discovery"> = {},
	): Promise<Result<Issuer, AuthError>> {
		let listed = this.metadata.authorizationServers;
		let chosen = authorizationServer === undefined ? listed[0] : new URL(authorizationServer);

		if (chosen === undefined) {
			return failure(
				new AuthError(`${this.metadata.resource.href} lists no authorization server.`, {
					code: AuthErrorCode.EndpointUnsupported,
				}),
			);
		}

		let server = chosen;
		if (!listed.some((entry) => sameServer(entry, server))) {
			return failure(
				new AuthError(
					`${this.metadata.resource.href} does not list ${server.href} as an authorization server.`,
					{ code: AuthErrorCode.IssuerMismatch },
				),
			);
		}

		let oauth = await readIssuer(Issuer.for(server, { ...options, discovery: "oauth" }));
		if (isSuccess(oauth) || !AuthError.is(oauth.error, AuthErrorCode.DiscoveryFailed)) return oauth;

		return await readIssuer(Issuer.for(server, { ...options, discovery: "openid" }));
	}
}

export namespace ProtectedResource {
	/** How a resource's metadata is fetched and checked. */
	export interface DiscoverOptions {
		/**
		 * `"prefix"` accepts a document whose `resource` is a same-origin, segment-aligned
		 * prefix of the URL asked about, for a client that met a challenge below the
		 * resource's root; RFC 9728 itself requires an exact match.
		 *
		 * @default "exact"
		 */
		match?: "exact" | "prefix";

		/** Where fetched documents are shared across isolates for an hour. */
		cache?: Issuer.CacheSource;
	}
}
