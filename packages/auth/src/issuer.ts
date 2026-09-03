/**
 * The authorization server every other class in this package talks to: it reads the
 * discovery document, hands out each advertised endpoint, resolves the published key
 * set, and verifies an ID token against both. `Issuer.for` shares one instance per URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";

import { JWK } from "@sdxc/jwt";
import { isFailure, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { minLength, url } from "remix/data-schema/checks";

import { AuthError, AuthErrorCode } from "./auth-error.js";
import { nonJsonMediaType } from "./content-type.js";
import { IdToken } from "./id-token.js";

/** Path OpenID Connect Discovery §4 appends to an issuer identifier. */
const DISCOVERY_PATH = "/.well-known/openid-configuration";

/**
 * How long a discovery document and a key set stay in the shared cache, which bounds
 * how stale an endpoint move can read. A newly published signing key stands apart: a
 * token naming one is what prompts the refetch that picks it up.
 */
const DEFAULT_TTL: DurationInput = "1 hour";

/** Prefix every cache entry this class writes is stored under. */
const CACHE_PREFIX = "auth:issuer";

/**
 * Covers the drift between the provider that signed a token and the server reading its
 * lifetime claims.
 */
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 60;

/** Matches the trailing slashes a URL identifier carries interchangeably. */
const TRAILING_SLASHES = /\/+$/;

/**
 * The `code` jose gives a resolver refusing a token its key set has no key for. It is
 * matched instead of the class, so a second copy of jose in the tree still reads as
 * the same refusal.
 */
const NO_MATCHING_KEY = "ERR_JWKS_NO_MATCHING_KEY";

/** A metadata member holding one absolute URL. */
const URL_SCHEMA = s.string().pipe(url());

/**
 * The `issuer` member, held to being a string a provider could publish. A provider
 * is free to publish an identifier that is not a URL, and the identity check is what
 * holds the value to the issuer the caller asked for.
 */
const IDENTIFIER_SCHEMA = s.string().pipe(minLength(1));

/** A metadata member holding a list of advertised values. */
const VALUES_SCHEMA = s.optional(s.array(s.string()));

/**
 * The members of a discovery document this package reads. Unlisted members are
 * dropped, so a provider may publish as many as it likes.
 */
const METADATA_SCHEMA = s.object({
	issuer: IDENTIFIER_SCHEMA,
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
 * An identifier in the form it compares. A URL identifier is read as a URL, so host
 * case and a trailing slash carry no meaning; every other identifier stands exactly
 * as it was published, so the comparison over it is byte for byte.
 *
 * @param identifier - The identifier to read.
 */
function comparableIssuer(identifier: string): string {
	if (!URL.canParse(identifier)) return identifier;
	return new URL(identifier).href.replace(TRAILING_SLASHES, "");
}

/**
 * Reports whether two identifiers name the same issuer, which is the check every
 * read of a discovery document is trusted on.
 *
 * @param left - One identifier.
 * @param right - The other identifier.
 */
function sameIssuer(left: string, right: string): boolean {
	return comparableIssuer(left) === comparableIssuer(right);
}

/**
 * Reports whether a resolver refused a token because the set in hand names no such
 * key, which is the refusal a newly published key can answer.
 *
 * @param error - What the resolver raised.
 */
function noMatchingKey(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === NO_MATCHING_KEY;
}

/**
 * Where a key set is stored in the shared cache, so a read and a replacement of it
 * name the same entry.
 *
 * @param url - Where the issuer serves its documents.
 */
function jwksCacheKey(url: URL): string {
	return `${CACHE_PREFIX}:jwks:${url.href}`;
}

/**
 * Names one configuration of an issuer by the options that change what it answers, so a
 * differing cache tier still resolves to one shared instance.
 *
 * @param url - Where the issuer serves its documents.
 * @param options - The rest of the configuration.
 */
function instanceKey(url: string | URL, options: Issuer.Options): string {
	let stated = String(url);
	let address = URL.canParse(stated) ? new URL(stated).href : stated;

	return JSON.stringify([
		address,
		options.identifier ?? null,
		String(options.ttl ?? DEFAULT_TTL),
		options.metadata ?? null,
	]);
}

/**
 * An OpenID Connect provider, addressed by its issuer identifier. Every document it
 * publishes is fetched once per cache TTL, however many callers and isolates ask for it,
 * and every read of it is checked against the issuer it was asked for.
 *
 * @example
 * let issuer = Issuer.for(env.OIDC_ISSUER, { cache: new Cache.KVStore(env.CACHE, waitUntil) });
 * let token = await issuer.verifyIdToken(raw, { audience: clientId });
 *
 * @example
 * let issuer = Issuer.for("https://auth.example.com", { identifier: "auth.example.com" });
 */
export class Issuer {
	/** Held for the life of the isolate, so the memos behind a configuration are shared. */
	static #instances = new Map<string, Issuer>();

	/**
	 * The issuer for a configuration, handed to every later caller asking on the same
	 * terms, so its documents are read once per isolate. The cache the first ask supplies
	 * is the one the instance keeps, so a per-request store goes in as a factory.
	 *
	 * @param url - Where the issuer serves its documents, as an absolute URL.
	 * @param options - The published identifier, the shared cache, inline metadata, and
	 *   the cache TTL. Everything but the cache names the instance, and every name asked
	 *   for is held for the life of the isolate, so these come from a fixed configuration
	 *   and a value that varies per request goes to the constructor.
	 * @returns The issuer for that configuration.
	 * @throws `Error` when the URL carries no scheme.
	 * @example
	 * let issuer = Issuer.for(AUTH_ORIGIN, { identifier: AUTH_IDENTIFIER, cache });
	 */
	static for(url: string | URL, options: Issuer.Options = {}): Issuer {
		let key = instanceKey(url, options);
		let held = Issuer.#instances.get(key);

		if (held) return held;

		let issuer = new Issuer(url, options);
		Issuer.#instances.set(key, issuer);

		return issuer;
	}

	/**
	 * Where the issuer serves its documents, which discovery appends its path to and
	 * every endpoint URL is resolved against.
	 */
	readonly url: URL;

	#cache: Issuer.CacheSource | null;
	#configured: Issuer.Metadata | null;
	#expected: string;
	#ttl: DurationInput;
	#metadata: Promise<Issuer.Metadata> | null = null;
	#keys: Promise<JWK.KeyResolver> | null = null;
	#refreshing: Promise<JWK.KeyResolver> | null = null;

	/**
	 * Answers with the key a token names, refetching the set once when the set in hand
	 * names no such key, so a rotation is picked up within the verification that met it
	 * rather than within a cache TTL.
	 */
	#resolve: JWK.KeyResolver = async (header, input) => {
		let held = await this.#current();
		let matched = await wrap(() => held(header, input));

		if (!isFailure(matched)) return matched.data;
		if (!noMatchingKey(matched.error)) throw matched.error;

		let refreshed = await this.#refresh(held);

		return await refreshed(header, input);
	};

	/**
	 * Points an instance at an issuer, with memos of its own, for a test or a one-off
	 * read.
	 *
	 * @param url - Where the issuer serves its documents, as an absolute URL.
	 * @param options - The published identifier, the shared cache, inline metadata,
	 *   and the cache TTL.
	 * @throws `Error` when the URL carries no scheme, since discovery is fetched from
	 *   it. A provider whose published identifier carries no scheme is reached by
	 *   stating its origin here and that identifier as `identifier`.
	 */
	constructor(url: string | URL, options: Issuer.Options = {}) {
		if (typeof url === "string" && !URL.canParse(url)) {
			throw new Error(
				`Discovery for ${url} is fetched from this URL, so it needs an absolute URL carrying a scheme. State the issuer's origin here, and the identifier it publishes as \`identifier\`.`,
			);
		}

		this.url = new URL(url);
		this.#cache = options.cache ?? null;
		this.#configured = options.metadata ?? null;
		this.#expected = options.identifier ?? this.url.href;
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
	 * The resolver picks a key per token from its `kid`, and a `kid` the set in hand
	 * lacks costs one refetch of the set, so a rotation verifies at once.
	 *
	 * @returns A resolver over the published key set.
	 * @throws `JwksFailed` when the set cannot be fetched, read, or holds no key, at
	 *   the ask and at every refetch a resolution spends.
	 */
	async keys(): Promise<JWK.KeyResolver> {
		await this.#current();
		return this.#resolve;
	}

	/**
	 * The verification the browser flow runs, so a token that arrived out of band — from a
	 * native client, an IdP-initiated flow, a fixture — is held to the same checks. The
	 * `nonce` and `at_hash` bindings come from the flow that started the login.
	 *
	 * @param raw - The token as the provider serialized it.
	 * @param options - The audience it names, the algorithms accepted, and the skew
	 *   tolerated, which stands at a minute when the caller states none.
	 * @returns The verified token, whose claims are trustworthy from here on.
	 * @throws {AuthError} `invalid_token` when any check on the token fails, and
	 *   `DiscoveryFailed` or `JwksFailed` when the issuer's own documents are unreadable.
	 * @example
	 * let idToken = await issuer.verifyIdToken(raw, { audience: CLIENT_ID });
	 */
	async verifyIdToken(raw: string, options: Issuer.IdTokenVerification): Promise<IdToken> {
		let [identifier, keys] = await Promise.all([this.identifier(), this.keys()]);

		let verified = await wrap(() =>
			IdToken.verify(raw, keys, {
				issuer: identifier,
				audience: options.audience,
				algorithms: options.algorithms,
				clockTolerance: options.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE_SECONDS,
			}),
		);

		if (isFailure(verified)) {
			/**
			 * An unreadable key set reaches here when a refetch during the resolution met
			 * it, and it says nothing about the token, so it stands as it is.
			 */
			if (AuthError.is(verified.error, AuthErrorCode.JwksFailed)) throw verified.error;

			throw new AuthError("The ID token failed verification", {
				code: AuthErrorCode.InvalidToken,
				cause: verified.error,
			});
		}

		return verified.data;
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

		if (!sameIssuer(result.value.issuer, this.#expected)) {
			throw new AuthError(
				`The document at ${this.url.href} names the issuer ${result.value.issuer} where ${this.#expected} was configured.`,
				{ code: AuthErrorCode.IssuerMismatch },
			);
		}

		return result.value;
	}

	/**
	 * The set in hand, imported once per instance and asked for again after a failed
	 * read, so an outage during one read leaves the next one free to succeed.
	 */
	async #current(): Promise<JWK.KeyResolver> {
		this.#keys ??= this.#importKeys();

		try {
			return await this.#keys;
		} catch (cause) {
			this.#keys = null;
			throw cause;
		}
	}

	/**
	 * The set a resolution reads on its second and last try. A set another caller
	 * already replaced is answered with as it stands, and callers meeting the rotation
	 * together share one read of the provider.
	 *
	 * @param stale - The set that named no key.
	 * @throws `JwksFailed` when the set cannot be fetched or read.
	 */
	async #refresh(stale: JWK.KeyResolver): Promise<JWK.KeyResolver> {
		let current = await this.#current();

		if (current !== stale) return current;

		this.#refreshing ??= this.#reload();

		try {
			return await this.#refreshing;
		} finally {
			this.#refreshing = null;
		}
	}

	/**
	 * Reads the key set past the cache and puts it in front of every later read: the
	 * instance's own set, and the entry other isolates share.
	 *
	 * @throws `JwksFailed` when the set cannot be fetched or read.
	 */
	async #reload(): Promise<JWK.KeyResolver> {
		let endpoint = await this.jwksUri();
		let body = await this.#text(endpoint, AuthErrorCode.JwksFailed);
		let resolver = await this.#readKeys(endpoint, body);

		this.#keys = Promise.resolve(resolver);
		await this.#store(jwksCacheKey(this.url), body);

		return resolver;
	}

	/** Produces the key resolver for the memo, going through the shared cache. */
	async #importKeys(): Promise<JWK.KeyResolver> {
		let endpoint = await this.jwksUri();

		let body = await this.#cached(jwksCacheKey(this.url), () =>
			this.#text(endpoint, AuthErrorCode.JwksFailed),
		);

		return await this.#readKeys(endpoint, body);
	}

	/**
	 * Reads a published key set into a resolver over it.
	 *
	 * @param endpoint - Where the set was published, which a failure names.
	 * @param body - The document as the provider served it.
	 * @throws `JwksFailed` when the document is unreadable or holds no key.
	 */
	async #readKeys(endpoint: URL, body: string): Promise<JWK.KeyResolver> {
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
	 * Puts a freshly read document in the shared cache. The document is already in
	 * hand, so a store that refused the write costs the next isolate a read of the
	 * provider and nothing more.
	 *
	 * @param key - Where the document is stored.
	 * @param body - The document as the provider served it.
	 */
	async #store(key: string, body: string): Promise<void> {
		let cache = typeof this.#cache === "function" ? this.#cache() : this.#cache;

		if (!cache) return;

		await wrap(() => cache.write(key, body, { ttl: this.#ttl }));
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
	 * spent once per TTL across every isolate reading the same issuer. A cache stated
	 * as a factory is resolved here, so the store belongs to the read reaching for it.
	 *
	 * @param key - Where the document is stored.
	 * @param load - Fetches the document on a miss.
	 */
	async #cached(key: string, load: () => Promise<string>): Promise<string> {
		let cache = typeof this.#cache === "function" ? this.#cache() : this.#cache;

		if (!cache) return await load();
		return await cache.fetch(key, load, { ttl: this.#ttl });
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

	/**
	 * A factory is resolved on every read, so a store built over per-request values — a
	 * `waitUntil` among them — stays current for an instance that outlives the request.
	 */
	export type CacheSource = CacheStore | (() => CacheStore);

	/** What an ID token is held to beyond the issuer's own signature and identifier. */
	export interface IdTokenVerification {
		/** The client id the token names as its `aud`, or the ids any one of which it may name. */
		audience: string | string[];

		/**
		 * The signature algorithms accepted, stated so a token presenting any other one is
		 * refused before a key is chosen for it.
		 *
		 * @default every algorithm the published key set supports
		 */
		algorithms?: JWK.Algorithm[];

		/**
		 * Seconds of clock skew tolerated on the lifetime claims.
		 *
		 * @default 60
		 */
		clockTolerance?: number;
	}

	/** How an {@link Issuer} is configured. */
	export interface Options {
		/**
		 * The identifier the provider publishes and writes into every token's `iss`, for one
		 * whose identifier stands apart from the URL its documents are served from. The
		 * document's `issuer` is held to this value, and `identifier()` answers with its own.
		 *
		 * @default the URL the instance was constructed with
		 */
		identifier?: string;

		/**
		 * Where fetched documents are shared across isolates. Omitting it keeps the
		 * documents for the life of the instance, and a store built over per-request values
		 * goes in as a factory.
		 */
		cache?: CacheSource;

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
