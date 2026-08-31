/**
 * The authorization server every other class in this package talks to. It reads the
 * issuer's discovery document, hands out each endpoint the provider advertises by
 * name, and resolves the published key set into the resolver a token is verified
 * through. One instance per issuer serves every role an app plays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

import { JWK } from "@pkg/jwt";
import { isFailure, wrap } from "@pkg/result";
import * as s from "remix/data-schema";
import { url } from "remix/data-schema/checks";

import { AuthError, AuthErrorCode } from "./auth-error";
import { nonJsonMediaType } from "./content-type";

/** Path OpenID Connect Discovery §4 appends to an issuer identifier. */
const DISCOVERY_PATH = "/.well-known/openid-configuration";

/**
 * How long a discovery document and a key set stay in the shared cache. It bounds
 * how soon a newly published signing key becomes verifiable, so a provider rotating
 * keys publishes them this far ahead of signing with them.
 */
const DEFAULT_TTL: DurationInput = "1 hour";

/** Prefix every cache entry this class writes is stored under. */
const CACHE_PREFIX = "auth:issuer";

/** Matches the trailing slashes a URL identifier carries interchangeably. */
const TRAILING_SLASHES = /\/+$/;

/** A metadata member holding one absolute URL. */
const URL_SCHEMA = s.string().pipe(url());

/** A metadata member holding a list of advertised values. */
const VALUES_SCHEMA = s.optional(s.array(s.string()));

/**
 * The members of a discovery document this package reads. Unlisted members are
 * dropped, so a provider may publish as many as it likes.
 */
const METADATA_SCHEMA = s.object({
	issuer: URL_SCHEMA,
	authorization_endpoint: URL_SCHEMA,
	token_endpoint: URL_SCHEMA,
	jwks_uri: URL_SCHEMA,
	userinfo_endpoint: s.optional(URL_SCHEMA),
	end_session_endpoint: s.optional(URL_SCHEMA),
	revocation_endpoint: s.optional(URL_SCHEMA),
	introspection_endpoint: s.optional(URL_SCHEMA),
	scopes_supported: VALUES_SCHEMA,
	response_types_supported: VALUES_SCHEMA,
	token_endpoint_auth_methods_supported: VALUES_SCHEMA,
	acr_values_supported: VALUES_SCHEMA,
	code_challenge_methods_supported: VALUES_SCHEMA,
});

/**
 * A JSON Web Key Set, with each entry kept whole: the key material a key type
 * publishes stays under whatever member names that type uses.
 */
const JWKS_SCHEMA = s.object({ keys: s.array(s.record(s.string(), s.any())) });

/** Metadata members naming an endpoint, which every endpoint accessor reads one of. */
type EndpointName = Extract<keyof Issuer.Metadata, `${string}_endpoint` | "jwks_uri">;

/** Metadata members listing advertised values, read by the corresponding accessors. */
type ValuesName = Extract<keyof Issuer.Metadata, `${string}_supported`>;

/**
 * Reports whether two identifiers name the same issuer. Both are read as URLs, so
 * host case and a trailing slash carry no meaning and every other difference does.
 *
 * @param left - One identifier.
 * @param right - The other identifier.
 */
function sameIssuer(left: string, right: string): boolean {
	return (
		new URL(left).href.replace(TRAILING_SLASHES, "") ===
		new URL(right).href.replace(TRAILING_SLASHES, "")
	);
}

/**
 * An OpenID Connect provider, addressed by its issuer identifier.
 *
 * Every document it publishes is fetched once per cache TTL, however many callers
 * ask for it and however many isolates serve them, and every read of it is checked
 * against the issuer it was asked for.
 *
 * @example
 * let issuer = new Issuer(env.OIDC_ISSUER, { cache: new Cache.KVStore(env.CACHE, waitUntil) });
 * let token = await IdToken.verify(raw, await issuer.keys(), { issuer: await issuer.identifier() });
 */
export class Issuer {
	/** The issuer identifier this instance was constructed with. */
	readonly url: URL;

	#cache: Issuer.CacheStore | null;
	#configured: Issuer.Metadata | null;
	#ttl: DurationInput;
	#metadata: Promise<Issuer.Metadata> | null = null;
	#keys: Promise<JWK.KeyResolver> | null = null;

	/**
	 * Points an instance at an issuer.
	 *
	 * @param url - The issuer identifier, which is also where its document is found.
	 * @param options - The shared cache, inline metadata, and the cache TTL.
	 */
	constructor(url: string | URL, options: Issuer.Options = {}) {
		this.url = new URL(url);
		this.#cache = options.cache ?? null;
		this.#configured = options.metadata ?? null;
		this.#ttl = options.ttl ?? DEFAULT_TTL;
	}

	/**
	 * The whole discovery document, with every member this package reads validated
	 * and the document's `issuer` confirmed to name the issuer it was asked for.
	 *
	 * @returns The metadata, from the memo, the shared cache, or the provider.
	 * @throws `DiscoveryFailed` when the document cannot be fetched or read, and
	 *   `IssuerMismatch` when it names another issuer.
	 */
	async metadata(): Promise<Issuer.Metadata> {
		this.#metadata ??= this.#discover();

		try {
			return await this.#metadata;
		} catch (cause) {
			this.#metadata = null;
			throw cause;
		}
	}

	/**
	 * The `issuer` value the provider publishes, which is the string its tokens carry
	 * as `iss` and the value a verification checks them against.
	 */
	async identifier(): Promise<string> {
		let metadata = await this.metadata();
		return metadata.issuer;
	}

	/**
	 * The keys the issuer publishes, ready to pass as `JWT.verify`'s second argument.
	 * The resolver picks a key per token from its `kid`, so tokens signed by a key the
	 * issuer still publishes keep verifying across a rotation.
	 *
	 * @returns A resolver over the published key set.
	 * @throws `JwksFailed` when the set cannot be fetched, read, or holds no key.
	 */
	async keys(): Promise<JWK.KeyResolver> {
		this.#keys ??= this.#importKeys();

		try {
			return await this.#keys;
		} catch (cause) {
			this.#keys = null;
			throw cause;
		}
	}

	/** Where a person is sent to authenticate and grant consent. */
	authorizationEndpoint(): Promise<URL> {
		return this.#endpoint("authorization_endpoint");
	}

	/** Where a code, a refresh token, or client credentials are exchanged for tokens. */
	tokenEndpoint(): Promise<URL> {
		return this.#endpoint("token_endpoint");
	}

	/** Where the issuer publishes the keys its tokens are signed with. */
	jwksUri(): Promise<URL> {
		return this.#endpoint("jwks_uri");
	}

	/**
	 * Where claims about the person behind an access token are read.
	 *
	 * @throws `EndpointUnsupported` when the provider advertises none.
	 */
	userInfoEndpoint(): Promise<URL> {
		return this.#endpoint("userinfo_endpoint");
	}

	/**
	 * Where a person is sent to end their session with the issuer itself.
	 *
	 * @throws `EndpointUnsupported` when the provider advertises none.
	 */
	endSessionEndpoint(): Promise<URL> {
		return this.#endpoint("end_session_endpoint");
	}

	/**
	 * Where a token is surrendered so the issuer stops honoring it.
	 *
	 * @throws `EndpointUnsupported` when the provider advertises none.
	 */
	revocationEndpoint(): Promise<URL> {
		return this.#endpoint("revocation_endpoint");
	}

	/**
	 * Where an opaque token is presented for the issuer to describe.
	 *
	 * @throws `EndpointUnsupported` when the provider advertises none.
	 */
	introspectionEndpoint(): Promise<URL> {
		return this.#endpoint("introspection_endpoint");
	}

	/** The scopes the issuer accepts, empty when it advertises no list. */
	scopesSupported(): Promise<string[]> {
		return this.#values("scopes_supported");
	}

	/** The `response_type` values the issuer accepts, empty when it advertises no list. */
	responseTypesSupported(): Promise<string[]> {
		return this.#values("response_types_supported");
	}

	/**
	 * How the issuer lets a client authenticate at the token endpoint, empty when it
	 * advertises no list.
	 */
	tokenEndpointAuthMethodsSupported(): Promise<string[]> {
		return this.#values("token_endpoint_auth_methods_supported");
	}

	/**
	 * The authentication context classes a step-up request may ask for, empty when the
	 * issuer advertises no list.
	 */
	acrValuesSupported(): Promise<string[]> {
		return this.#values("acr_values_supported");
	}

	/** The PKCE challenge methods the issuer accepts, empty when it advertises no list. */
	codeChallengeMethodsSupported(): Promise<string[]> {
		return this.#values("code_challenge_methods_supported");
	}

	/**
	 * Produces the metadata for the memo, reading configured metadata when there is
	 * some and going through the shared cache to the provider otherwise.
	 */
	async #discover(): Promise<Issuer.Metadata> {
		if (this.#configured) return this.#readMetadata(this.#configured);

		let endpoint = new URL(`${this.url.href.replace(TRAILING_SLASHES, "")}${DISCOVERY_PATH}`);

		let body = await this.#cached(`${CACHE_PREFIX}:metadata:${this.url.href}`, () =>
			this.#text(endpoint, AuthErrorCode.DiscoveryFailed),
		);

		return this.#readMetadata(this.#json(body, AuthErrorCode.DiscoveryFailed));
	}

	/**
	 * Validates a document and confirms it names the issuer it was asked for, which
	 * is what lets every later read of it be trusted.
	 *
	 * @param document - The document, as fetched or as configured.
	 */
	#readMetadata(document: unknown): Issuer.Metadata {
		let result = s.parseSafe(METADATA_SCHEMA, document);

		if (!result.success) {
			throw new AuthError(`${this.url.href} published an unreadable discovery document.`, {
				code: AuthErrorCode.DiscoveryFailed,
				cause: result.issues,
			});
		}

		if (!sameIssuer(result.value.issuer, this.url.href)) {
			throw new AuthError(
				`The document at ${this.url.href} names the issuer ${result.value.issuer}.`,
				{ code: AuthErrorCode.IssuerMismatch },
			);
		}

		return result.value;
	}

	/** Produces the key resolver for the memo, going through the shared cache. */
	async #importKeys(): Promise<JWK.KeyResolver> {
		let endpoint = await this.jwksUri();

		let body = await this.#cached(`${CACHE_PREFIX}:jwks:${this.url.href}`, () =>
			this.#text(endpoint, AuthErrorCode.JwksFailed),
		);

		let result = s.parseSafe(JWKS_SCHEMA, this.#json(body, AuthErrorCode.JwksFailed));

		if (!result.success) {
			throw new AuthError(`${endpoint.href} published an unreadable key set.`, {
				code: AuthErrorCode.JwksFailed,
				cause: result.issues,
			});
		}

		if (result.value.keys.length === 0) {
			throw new AuthError(`${endpoint.href} published a key set holding no key.`, {
				code: AuthErrorCode.JwksFailed,
			});
		}

		return await JWK.importLocal(result.value);
	}

	/**
	 * Reads one endpoint out of the metadata.
	 *
	 * @param name - The member naming the endpoint.
	 * @throws `EndpointUnsupported` when the provider advertises no such endpoint.
	 */
	async #endpoint(name: EndpointName): Promise<URL> {
		let metadata = await this.metadata();
		let endpoint = metadata[name];

		if (!endpoint) {
			throw new AuthError(`The issuer ${this.url.href} advertises no ${name}.`, {
				code: AuthErrorCode.EndpointUnsupported,
			});
		}

		return new URL(endpoint);
	}

	/**
	 * Reads one advertised list out of the metadata.
	 *
	 * @param name - The member holding the list.
	 * @returns The advertised values, empty when the provider publishes no list.
	 */
	async #values(name: ValuesName): Promise<string[]> {
		let metadata = await this.metadata();
		return metadata[name] ?? [];
	}

	/**
	 * Reads a document through the shared cache when there is one, so the fetch is
	 * spent once per TTL across every isolate reading the same issuer.
	 *
	 * @param key - Where the document is stored.
	 * @param load - Fetches the document on a miss.
	 */
	async #cached(key: string, load: () => Promise<string>): Promise<string> {
		if (!this.#cache) return await load();
		return await this.#cache.fetch(key, load, { ttl: this.#ttl });
	}

	/**
	 * Fetches a document as text, reporting a transport failure and a non-2xx answer
	 * alike under the caller's code. An issuer that declares a media type other than
	 * JSON is reported from that header alone, with the type it named.
	 *
	 * @param endpoint - Where to read the document from.
	 * @param code - The code a failure is reported as.
	 */
	async #text(endpoint: URL, code: AuthErrorCode): Promise<string> {
		let answer = await wrap(() => fetch(endpoint, { headers: { accept: "application/json" } }));

		if (isFailure(answer)) {
			throw new AuthError(`The request to ${endpoint.href} did not complete.`, {
				code,
				cause: answer.error,
			});
		}

		let response = answer.data;

		if (!response.ok) {
			throw new AuthError(`${endpoint.href} answered with status ${response.status}.`, { code });
		}

		let mediaType = nonJsonMediaType(response);

		if (mediaType !== null) {
			throw new AuthError(`${endpoint.href} answered with ${mediaType} instead of JSON.`, { code });
		}

		return await response.text();
	}

	/**
	 * Reads a document body as JSON.
	 *
	 * @param body - The response body.
	 * @param code - The code a syntax error is reported as.
	 */
	#json(body: string, code: AuthErrorCode): unknown {
		try {
			return JSON.parse(body) as unknown;
		} catch (cause) {
			throw new AuthError(`The issuer ${this.url.href} answered with something other than JSON.`, {
				code,
				cause,
			});
		}
	}
}

export namespace Issuer {
	/**
	 * A discovery document, in the shape a provider publishes it, so a document
	 * copied from an issuer is accepted as configured metadata unchanged.
	 */
	export interface Metadata {
		/** The identifier the issuer's tokens carry as `iss`. */
		issuer: string;
		authorization_endpoint: string;
		token_endpoint: string;
		jwks_uri: string;
		userinfo_endpoint?: string;
		end_session_endpoint?: string;
		revocation_endpoint?: string;
		introspection_endpoint?: string;
		scopes_supported?: string[];
		response_types_supported?: string[];
		token_endpoint_auth_methods_supported?: string[];
		acr_values_supported?: string[];
		code_challenge_methods_supported?: string[];
	}

	/** Expiration a cache write carries. */
	export interface CacheWriteOptions {
		/** How long the entry stays readable. */
		ttl?: DurationInput;
	}

	/**
	 * The cache tier an `Issuer` shares with every isolate reading the same issuer.
	 * `Cache.KVStore` satisfies it, and so does any store keyed by a string.
	 */
	export interface CacheStore {
		/** Reads an entry, or `null` when it is missing or expired. */
		read(key: string): Promise<string | null>;
		/** Writes an entry, replacing any current value for the key. */
		write(key: string, value: string, options?: CacheWriteOptions): Promise<void>;
		/** Returns the stored entry, computing and storing it on a miss. */
		fetch(key: string, load: () => Promise<string>, options?: CacheWriteOptions): Promise<string>;
	}

	/** How an {@link Issuer} is configured. */
	export interface Options {
		/**
		 * Where fetched documents are shared across isolates. Omitting it keeps the
		 * documents for the life of the instance.
		 */
		cache?: CacheStore;

		/**
		 * Metadata supplied by the app, served in place of the provider's document and
		 * checked the same way.
		 */
		metadata?: Metadata;

		/**
		 * How long a document stays in the shared cache.
		 *
		 * @default "1 hour"
		 */
		ttl?: DurationInput;
	}
}
