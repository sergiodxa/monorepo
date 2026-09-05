/**
 * The client an app runs as itself, with no person present. It holds the
 * `client_credentials` grant for cron jobs, queue consumers and server-to-server reads,
 * hands out one cached token per client and resource set, and describes or revokes one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Adapter } from "@sdxc/rate-limit";

import * as s from "@remix-run/data-schema";
import { Base64 } from "@sdxc/crypto";
import { toSeconds } from "@sdxc/duration";
import { isFailure, wrap } from "@sdxc/result";

import type { Issuer } from "./issuer.js";

import { AuthError, AuthErrorCode } from "./auth-error.js";
import { nonJsonMediaType } from "./content-type.js";
import { accessTokenExpiry, spent } from "./expiry.js";

/**
 * How much of a token's life is kept in reserve. A token handed out is valid for
 * at least this long, which covers the request it is about to authenticate plus
 * the clock skew between this worker and the resource server checking it.
 */
const DEFAULT_EXPIRATION_MARGIN: DurationInput = "30 seconds";

/** Milliseconds in a second, the factor between a token's claims and a `Date`. */
const MS_PER_SECOND = 1000;

/**
 * Shortest TTL the shared tier accepts, which Cloudflare KV sets at 60 seconds.
 * A token whose remaining life is under it lives in the isolate for as long as it
 * is good for, and the next isolate asks the issuer for one of its own.
 */
const MINIMUM_SHARED_TTL_SECONDS = 60;

/** Prefix every cached grant is stored under. */
const CACHE_PREFIX = "auth:client-credentials";

/** Prefix the rate limit budget for the token grant is counted under. */
const RATE_LIMIT_PREFIX = "auth:client-credentials";

/** Matches the space `application/x-www-form-urlencoded` writes as a plus sign. */
const ENCODED_SPACE = /%20/g;

/**
 * Fields the grant states for itself. `tokenParams` is checked against them where
 * it is configured, so which grant runs, which client it runs as, and which
 * resources it is scoped to stay decided here.
 */
const RESERVED_TOKEN_PARAMETERS = new Set([
	"grant_type",
	"client_id",
	"client_secret",
	"client_assertion",
	"client_assertion_type",
	"resource",
	"scope",
]);

/** A successful grant, per RFC 6749 §5.1. */
const GRANT_SCHEMA = s.object({
	access_token: s.string(),
	token_type: s.optional(s.string()),
	expires_in: s.optional(s.number()),
	scope: s.optional(s.string()),
});

/** A refused request, in the shape RFC 6749 §5.2 defines for the token endpoint. */
const REFUSAL_SCHEMA = s.object({
	error: s.string(),
	error_description: s.optional(s.string()),
});

/** A token description, per RFC 7662 §2.2, where only `active` is required. */
const INTROSPECTION_SCHEMA = s.object({
	active: s.boolean(),
	scope: s.optional(s.string()),
	client_id: s.optional(s.string()),
	username: s.optional(s.string()),
	token_type: s.optional(s.string()),
	exp: s.optional(s.number()),
	iat: s.optional(s.number()),
	sub: s.optional(s.string()),
	aud: s.optional(s.union([s.string(), s.array(s.string())])),
	iss: s.optional(s.string()),
});

/**
 * A grant as the shared tier stores it, with the expiry resolved to a wall clock in
 * the epoch seconds a token's own `exp` is counted in.
 */
const CACHED_GRANT_SCHEMA = s.object({ access_token: s.string(), expires_at: s.number() });

/** A granted token together with when it stops being usable. */
interface Grant {
	accessToken: string;
	/** Epoch seconds the token expires at; `null` when nothing states its lifetime. */
	expiresAt: number | null;
}

/**
 * Encodes one half of a Basic credential the way RFC 6749 §2.3.1 requires: as
 * `application/x-www-form-urlencoded` text, so a credential holding a colon or a
 * space survives the round-trip to the issuer.
 *
 * @param value - The client id or the client secret.
 */
function formUrlEncode(value: string): string {
	return encodeURIComponent(value).replace(ENCODED_SPACE, "+");
}

/**
 * Reads a list-or-scalar `aud` as a list, so a caller compares audiences one way
 * whichever shape the issuer chose.
 *
 * @param value - The `aud` member of an introspection response.
 */
function toAudience(value: string | string[] | undefined): string[] {
	if (value === undefined) return [];
	if (typeof value === "string") return [value];
	return value;
}

/**
 * Reads a claim counted in seconds as a `Date`.
 *
 * @param value - Seconds since the epoch, as the issuer sent them.
 */
function toDate(value: number | undefined): Date | null {
	if (value === undefined) return null;
	return new Date(value * MS_PER_SECOND);
}

/**
 * A confidential client acting on its own behalf. One token is granted per client and
 * resource set however many callers ask and however many of them ask at once, and a token
 * is handed out only while it has life enough left for the service it is sent to.
 *
 * @example
 * let service = new ServiceClient(issuer, { clientId, clientSecret });
 * let token = await service.token({ resources: ["https://api.example.com"] });
 */
export class ServiceClient {
	#issuer: Issuer;
	#clientId: string;
	#clientSecret: string;
	#clientAuth: ServiceClient.ClientAuthMethod;
	#scope: string[];
	#tokenParams: Record<string, string>;
	#cache: Issuer.CacheStore | null;
	#rateLimit: Adapter | null;
	#waitUntil: ServiceClient.WaitUntil | null;
	/** The reserve in seconds, so it compares directly against a token's `exp`. */
	#margin: number;
	#grants = new Map<string, Promise<Grant>>();

	/**
	 * Configures a client against an issuer.
	 *
	 * @param issuer - The provider whose endpoints every call goes to.
	 * @param options - Credentials, and the seams named in {@link ServiceClient.Options}.
	 * @throws `ReservedParameter` when `tokenParams` names a field the grant owns.
	 */
	constructor(issuer: Issuer, options: ServiceClient.Options) {
		this.#issuer = issuer;
		this.#clientId = options.clientId;
		this.#clientSecret = options.clientSecret;
		this.#clientAuth = options.clientAuth ?? "client_secret_post";
		this.#scope = options.scope ?? [];
		this.#tokenParams = options.tokenParams ?? {};
		this.#cache = options.cache ?? null;
		this.#rateLimit = options.rateLimit ?? null;
		this.#waitUntil = options.waitUntil ?? null;
		this.#margin = toSeconds(options.expirationMargin ?? DEFAULT_EXPIRATION_MARGIN);

		for (let name of Object.keys(this.#tokenParams)) {
			if (!RESERVED_TOKEN_PARAMETERS.has(name)) continue;
			throw new AuthError(`The token parameter ${name} is set by the grant itself.`, {
				code: AuthErrorCode.ReservedParameter,
			});
		}
	}

	/** The client this instance authenticates as, and the identity its tokens carry. */
	get clientId(): string {
		return this.#clientId;
	}

	/**
	 * The provider every call goes to, so a collaborator reaching that provider's
	 * other APIs derives its own origin from this one.
	 */
	get issuer(): Issuer {
		return this.#issuer;
	}

	/**
	 * The access token for a resource set, ready for an `Authorization: Bearer`
	 * header. Each resource travels as its own `resource` field, which is how
	 * RFC 8707 §2 scopes a token to several services at once.
	 *
	 * @param options - The resources and scopes this token is for.
	 * @returns The bearer token, from the isolate, the shared cache, or a new grant.
	 * @throws `RateLimited` when the client's budget for the grant is spent, and
	 *   `TokenRequestFailed` when the issuer refuses it or answers unusably.
	 */
	async token(options: ServiceClient.TokenOptions = {}): Promise<string> {
		let key = this.#key(options);
		let memoized = this.#grants.get(key);

		if (memoized) {
			let grant = await memoized;
			if (this.#usable(grant)) return grant.accessToken;
			this.#grants.delete(key);
		}

		let pending = this.#grant(key, options);
		this.#grants.set(key, pending);

		try {
			let grant = await pending;
			return grant.accessToken;
		} catch (cause) {
			this.#grants.delete(key);
			throw cause;
		}
	}

	/**
	 * What the issuer says about a token, per RFC 7662. An `active` answer of
	 * `false` is the ordinary reply for a token that is unknown, expired, or
	 * revoked, so the caller branches on the value it gets back.
	 *
	 * @param token - The token to describe, opaque or signed.
	 * @param options - The token type hint to send with it.
	 * @returns The description, with its claims named and its scopes split.
	 * @throws `EndpointUnsupported` when the issuer advertises no introspection
	 *   endpoint, `IntrospectionFailed` when it refuses the call, and `InvalidToken`
	 *   when its answer says nothing about the token's state.
	 */
	async introspect(
		token: string,
		options: ServiceClient.IntrospectOptions = {},
	): Promise<ServiceClient.Introspection> {
		let endpoint = await this.#issuer.introspectionEndpoint();

		let body = new URLSearchParams({ token });
		if (options.tokenType) body.set("token_type_hint", options.tokenType);

		let document = await this.#read(endpoint, body, AuthErrorCode.IntrospectionFailed);
		let result = s.parseSafe(INTROSPECTION_SCHEMA, document);

		if (!result.success) {
			throw new AuthError(`${endpoint.href} described the token unreadably.`, {
				code: AuthErrorCode.InvalidToken,
				cause: result.issues,
			});
		}

		let description = result.value;

		return {
			active: description.active,
			scopes: description.scope?.split(" ").filter((scope) => scope.length > 0) ?? [],
			clientId: description.client_id ?? null,
			subject: description.sub ?? null,
			username: description.username ?? null,
			tokenType: description.token_type ?? null,
			audience: toAudience(description.aud),
			issuer: description.iss ?? null,
			issuedAt: toDate(description.iat),
			expiresAt: toDate(description.exp),
		};
	}

	/**
	 * Asks the issuer to stop honoring a token, per RFC 7009. With a `waitUntil`
	 * configured the response is sent while the call finishes in the background, and
	 * the promise handed to it carries the outcome.
	 *
	 * @param token - The token to surrender.
	 * @param options - The token type hint to send with it.
	 * @throws `EndpointUnsupported` when the issuer advertises no revocation
	 *   endpoint, and `RevocationFailed` when it refuses the call.
	 */
	async revoke(token: string, options: ServiceClient.RevokeOptions = {}): Promise<void> {
		let call = this.#revoke(token, options);

		if (this.#waitUntil) {
			this.#waitUntil(call);
			return;
		}

		await call;
	}

	/** Surrenders the token, from the caller's turn or from the background. */
	async #revoke(token: string, options: ServiceClient.RevokeOptions): Promise<void> {
		let endpoint = await this.#issuer.revocationEndpoint();

		let body = new URLSearchParams({ token });
		if (options.tokenType) body.set("token_type_hint", options.tokenType);

		let response = await this.#post(endpoint, body, AuthErrorCode.RevocationFailed);
		if (!response.ok) throw await this.#refusal(response, endpoint, AuthErrorCode.RevocationFailed);
	}

	/**
	 * Produces the grant the isolate memoizes: the shared tier first, then the
	 * issuer, so the budget and the round-trip are spent only on a token no tier
	 * already holds.
	 *
	 * @param key - Where this resource set's grant is cached.
	 * @param options - The resources and scopes the token is for.
	 */
	async #grant(key: string, options: ServiceClient.TokenOptions): Promise<Grant> {
		let cached = await this.#cached(key);
		if (cached) return cached;

		await this.#spend();

		let grant = await this.#request(options);
		await this.#store(key, grant);

		return grant;
	}

	/**
	 * Exchanges the credentials for a token.
	 *
	 * @param options - The resources and scopes the token is for.
	 * @throws `TokenRequestFailed` when the issuer refuses the grant or answers with
	 *   something other than a token.
	 */
	async #request(options: ServiceClient.TokenOptions): Promise<Grant> {
		let endpoint = await this.#issuer.tokenEndpoint();

		let body = new URLSearchParams({ grant_type: "client_credentials" });

		let scope = options.scope ?? this.#scope;
		if (scope.length > 0) body.set("scope", scope.join(" "));

		for (let [name, value] of Object.entries(this.#tokenParams)) body.set(name, value);

		for (let resource of options.resources ?? []) body.append("resource", resource);

		let document = await this.#read(endpoint, body, AuthErrorCode.TokenRequestFailed);
		let result = s.parseSafe(GRANT_SCHEMA, document);

		if (!result.success) {
			throw new AuthError(`${endpoint.href} answered the grant without an access token.`, {
				code: AuthErrorCode.TokenRequestFailed,
				cause: result.issues,
			});
		}

		let lifetime = result.value.expires_in;
		let stated = lifetime === undefined ? null : Math.floor(Date.now() / MS_PER_SECOND) + lifetime;

		return {
			accessToken: result.value.access_token,
			expiresAt: accessTokenExpiry(result.value.access_token, stated),
		};
	}

	/**
	 * Reads a grant out of the shared tier, treating an entry that is unreadable or
	 * inside the expiry margin as one to replace.
	 *
	 * @param key - Where this resource set's grant is cached.
	 */
	async #cached(key: string): Promise<Grant | null> {
		if (!this.#cache) return null;

		let entry = await this.#cache.read(key);
		if (entry === null) return null;

		let document = wrap(() => JSON.parse(entry) as unknown);
		if (isFailure(document)) return null;

		let result = s.parseSafe(CACHED_GRANT_SCHEMA, document.data);
		if (!result.success) return null;

		let grant: Grant = {
			accessToken: result.value.access_token,
			expiresAt: accessTokenExpiry(result.value.access_token, result.value.expires_at),
		};

		return this.#usable(grant) ? grant : null;
	}

	/**
	 * Publishes a grant to the shared tier under a TTL that runs out at the start of
	 * the expiry margin, so every isolate reading it gets a token with life left.
	 *
	 * @param key - Where this resource set's grant is cached.
	 * @param grant - The token and its expiry.
	 */
	async #store(key: string, grant: Grant): Promise<void> {
		if (!this.#cache) return;
		if (grant.expiresAt === null) return;

		let ttl = grant.expiresAt - this.#margin - Math.floor(Date.now() / MS_PER_SECOND);
		if (ttl < MINIMUM_SHARED_TTL_SECONDS) return;

		let entry = JSON.stringify({
			access_token: grant.accessToken,
			expires_at: grant.expiresAt,
		});

		await this.#cache.write(key, entry, { ttl });
	}

	/**
	 * Spends one unit of the client's budget for the grant. A backend that cannot answer
	 * lets the attempt through, so scheduled work keeps running through a limiter outage,
	 * and the issuer enforces its own limit on every grant it sees.
	 *
	 * @throws `RateLimited` when the budget for this client is spent.
	 */
	async #spend(): Promise<void> {
		if (!this.#rateLimit) return;

		let key = `${RATE_LIMIT_PREFIX}:${this.#clientId}`;
		let result = await this.#rateLimit.consume(key);
		if (isFailure(result)) return;
		if (result.data.allowed) return;

		throw new AuthError(
			`The grant budget for ${this.#clientId} is spent for another ${result.data.retryAfter} seconds.`,
			{ code: AuthErrorCode.RateLimited },
		);
	}

	/**
	 * Posts a form to an endpoint and reads its answer as JSON.
	 *
	 * @param endpoint - Where the form is posted.
	 * @param body - The fields, already carrying anything repeated.
	 * @param code - Names the endpoint the call went to in whatever it throws.
	 * @throws `code` when the issuer refuses the call or answers with something
	 *   other than JSON, naming the media type an answer declared.
	 */
	async #read(endpoint: URL, body: URLSearchParams, code: AuthErrorCode): Promise<unknown> {
		let response = await this.#post(endpoint, body, code);

		if (!response.ok) throw await this.#refusal(response, endpoint, code);

		let mediaType = nonJsonMediaType(response);

		if (mediaType !== null) {
			throw new AuthError(`${endpoint.href} answered with ${mediaType} instead of JSON.`, { code });
		}

		try {
			return (await response.json()) as unknown;
		} catch (cause) {
			throw new AuthError(`${endpoint.href} answered with something other than JSON.`, {
				code,
				cause,
			});
		}
	}

	/**
	 * Posts a form with the client authenticated by the configured method. The
	 * client id travels in the body either way, so the issuer names the caller from
	 * one place regardless of where the secret went.
	 *
	 * @param endpoint - Where the form is posted.
	 * @param body - The fields, already carrying anything repeated.
	 * @param code - Names the endpoint the call went to in whatever it throws.
	 * @throws `code` when the request does not complete.
	 */
	async #post(endpoint: URL, body: URLSearchParams, code: AuthErrorCode): Promise<Response> {
		let headers = new Headers({ accept: "application/json" });

		body.set("client_id", this.#clientId);

		if (this.#clientAuth === "client_secret_basic") {
			let credentials = `${formUrlEncode(this.#clientId)}:${formUrlEncode(this.#clientSecret)}`;
			headers.set("authorization", `Basic ${Base64.encode(credentials)}`);
		} else {
			body.set("client_secret", this.#clientSecret);
		}

		try {
			return await fetch(endpoint, { method: "POST", headers, body });
		} catch (cause) {
			throw new AuthError(`The request to ${endpoint.href} did not complete.`, {
				code,
				cause,
			});
		}
	}

	/**
	 * Turns a refusal into the error to throw, carrying the issuer's own `error` and
	 * `error_description` when it sent them, so an operator reads the provider's own
	 * reason for the refusal.
	 *
	 * @param response - The refused response.
	 * @param endpoint - Where it came from.
	 * @param code - Names the endpoint the call went to in the error it builds.
	 */
	async #refusal(response: Response, endpoint: URL, code: AuthErrorCode): Promise<AuthError> {
		let message = `${endpoint.href} answered with status ${response.status}.`;

		let mediaType = nonJsonMediaType(response);

		if (mediaType !== null) {
			return new AuthError(`${message} Its body arrived as ${mediaType}.`, { code });
		}

		let document = await wrap(async () => (await response.json()) as unknown);

		if (isFailure(document)) {
			return new AuthError(message, { code });
		}

		let result = s.parseSafe(REFUSAL_SCHEMA, document.data);

		if (!result.success) {
			return new AuthError(message, { code });
		}

		return new AuthError(`${message} ${result.value.error}`, {
			code,
			providerError: result.value.error,
			providerErrorDescription: result.value.error_description,
		});
	}

	/**
	 * Where a resource set's grant is cached. The client id and both requested sets are
	 * part of the key, so a token scoped to one set serves only callers asking for that
	 * same set, and each set is sorted so a caller's ordering carries no meaning.
	 *
	 * @param options - The resources and scopes the token is for.
	 */
	#key(options: ServiceClient.TokenOptions): string {
		let resources = [...(options.resources ?? [])].sort().join(" ");
		let scope = [...(options.scope ?? this.#scope)].sort().join(" ");
		return `${CACHE_PREFIX}:${this.#clientId}:${resources}:${scope}`;
	}

	/**
	 * Whether a token still has more life left than the expiry margin, which is what
	 * makes it safe to hand to a caller about to send it somewhere.
	 *
	 * @param grant - The token and its expiry.
	 */
	#usable(grant: Grant): boolean {
		return !spent(grant.expiresAt, this.#margin);
	}
}

export namespace ServiceClient {
	/**
	 * How the client proves who it is at the issuer's endpoints. `client_secret_post`
	 * carries the secret in the form body; `client_secret_basic` carries it in the
	 * `Authorization` header, form-urlencoded as RFC 6749 §2.3.1 states.
	 */
	export type ClientAuthMethod = "client_secret_post" | "client_secret_basic";

	/** Which kind of token a call is about, as RFC 7009 and RFC 7662 name them. */
	export type TokenTypeHint = "access_token" | "refresh_token";

	/** Runs work after the response is sent, in the shape the Workers runtime hands out. */
	export type WaitUntil = (promise: Promise<unknown>) => void;

	/** How a {@link ServiceClient} is configured. */
	export interface Options {
		/** The confidential client's identifier at the issuer. */
		clientId: string;

		/** The confidential client's secret. */
		clientSecret: string;

		/**
		 * How the client authenticates, matching one of the issuer's advertised
		 * methods.
		 *
		 * @default "client_secret_post"
		 */
		clientAuth?: ClientAuthMethod;

		/** Scopes every grant asks for, which one call may replace. */
		scope?: string[];

		/**
		 * Extra fields to send with the grant, for a parameter the issuer defines for
		 * itself. Fields the grant states — the grant type, the credentials, the
		 * resources, and the scopes — are configured through their own options.
		 */
		tokenParams?: Record<string, string>;

		/**
		 * Where granted tokens are shared across isolates, so a cold start reuses a
		 * token another isolate paid for. Omitting it keeps tokens for the life of the
		 * instance.
		 */
		cache?: Issuer.CacheStore;

		/** The budget the token grant is counted against, keyed by the client id. */
		rateLimit?: Adapter;

		/** Lets a revocation finish after the response is sent. */
		waitUntil?: WaitUntil;

		/**
		 * How much of a token's life is kept in reserve, covering the request it
		 * authenticates and the clock skew at the service checking it.
		 *
		 * @default "30 seconds"
		 */
		expirationMargin?: DurationInput;
	}

	/** What one token is asked for. */
	export interface TokenOptions {
		/**
		 * The services the token is for, as RFC 8707 resource indicators. Each travels
		 * as its own `resource` field, and the set is part of the cache key.
		 */
		resources?: string[];

		/** Scopes for this token, in place of the client's configured scopes. */
		scope?: string[];
	}

	/** What one introspection call is about. */
	export interface IntrospectOptions {
		/** The kind of token being presented, which lets the issuer look it up first. */
		tokenType?: TokenTypeHint;
	}

	/** What one revocation call is about. */
	export interface RevokeOptions {
		/** The kind of token being surrendered, which lets the issuer look it up first. */
		tokenType?: TokenTypeHint;
	}

	/**
	 * What the issuer says about a token, with the claims named and the scopes split.
	 * Every member other than `active` is populated only as far as the issuer chose
	 * to describe the token.
	 */
	export interface Introspection {
		/** Whether the issuer still honors the token. */
		active: boolean;

		/** The granted scopes as a list, from the one space-separated string `scope`. */
		scopes: string[];

		/** The client the token was issued to, from `client_id`. */
		clientId: string | null;

		/** Who the token is about, a person or the client itself, from `sub`. */
		subject: string | null;

		/** The readable identifier the issuer holds for the subject, from `username`. */
		username: string | null;

		/** How the token is presented, `Bearer` for everything this package sends. */
		tokenType: string | null;

		/** The services the token is good at, from `aud`. */
		audience: string[];

		/** The identifier the token carries as `iss`. */
		issuer: string | null;

		/** When the token was minted, from `iat`. */
		issuedAt: Date | null;

		/** When the issuer stops honoring the token, from `exp`. */
		expiresAt: Date | null;
	}
}
