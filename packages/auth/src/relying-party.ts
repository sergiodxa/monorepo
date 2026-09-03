/**
 * The browser login flow: the authorization redirect, the callback that turns a code
 * into a verified token set, and RP-initiated logout. It owns `state`, PKCE, the `nonce`,
 * and step-up, so every claim an app reads is checked against what the request asked for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationString } from "@sdxc/duration";
import type { JWK, JWT } from "@sdxc/jwt";
import type { Adapter } from "@sdxc/rate-limit";
import type {
	AuthScheme,
	AuthSchemeAuthenticateResult,
	AuthSchemeFailure,
} from "remix/middleware/auth";

import { Base64, Base64Url, randomToken, sha256, sha384, sha512 } from "@sdxc/crypto";
import { toSeconds } from "@sdxc/duration";
import { getClientIP } from "@sdxc/get-client-ip";
import { Location } from "@sdxc/location";
import { applyRateLimitHeaders } from "@sdxc/rate-limit";
import { isFailure, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { redirect } from "remix/response/redirect";
import { Session } from "remix/session";

import type { Issuer } from "./issuer.js";

import { AccessToken } from "./access-token.js";
import { AuthError, AuthErrorCode } from "./auth-error.js";
import { AuthSession } from "./auth-session.js";
import { nonJsonMediaType } from "./content-type.js";
import { IdToken } from "./id-token.js";

/** Milliseconds in a second, the unit `auth_time` and `expires_in` count in. */
const MS_PER_SECOND = 1000;

/** Bytes of entropy behind `state`, the `nonce`, and the PKCE verifier. */
const RANDOM_TOKEN_BYTES = 32;

/** The scopes a login asks for when the caller names none. */
const DEFAULT_SCOPES = ["openid", "profile", "email"];

/** The `amr`/`acr` values that count as more than one factor when none are named. */
const DEFAULT_MFA_VALUES = ["mfa"];

/** Seconds of clock skew tolerated between this server and the issuer. */
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 60;

/** Where a login returns to when the caller named no destination. */
const DEFAULT_RETURN_TO = "/";

/** Prefix the budget for starting a login is counted under. */
const RATE_LIMIT_PREFIX = "auth:authorize";

/**
 * Identifies an attempt arriving without an edge-reported IP, so every such
 * attempt is counted against one shared budget.
 */
const UNKNOWN_CLIENT_IP = "unknown";

/**
 * The status the login and logout redirects carry, per RFC 9110 §15.4.4. A form post
 * starts both, and 303 is what tells the browser to reach the destination with a GET
 * rather than repeating the post against it.
 */
const SEE_OTHER_STATUS = 303;

/** The status a spent login budget answers a browser with, per RFC 6585 §4. */
const RATE_LIMITED_STATUS = 429;

/** What a refused login says to the person who asked for it. */
const RATE_LIMITED_BODY = "Too many sign-in attempts. Try again shortly.";

/**
 * The session key the login transaction occupies. One key holds the whole
 * transaction, which stays on the server, so every field in it is equally trusted.
 */
const TRANSACTION_SESSION_KEY = "auth:transaction";

/**
 * The authorization parameters this class writes itself. A caller-supplied value
 * for any of them is refused, which is what keeps callback correlation — the
 * `state`, the `nonce`, and the PKCE challenge — answering to this class alone.
 */
const RESERVED_AUTHORIZATION_PARAMS = [
	"state",
	"client_id",
	"redirect_uri",
	"response_type",
	"scope",
	"code_challenge",
	"code_challenge_method",
	"nonce",
];

/**
 * The token-request parameters this class writes itself, so a caller cannot
 * redirect the grant or replace the credentials it is presented with.
 */
const RESERVED_TOKEN_PARAMS = [
	"grant_type",
	"code",
	"code_verifier",
	"redirect_uri",
	"refresh_token",
	"client_id",
	"client_secret",
];

/**
 * The claims a profile is built from. `userInfo: "when-missing"` spends its
 * round-trip unless the ID token carries every one of them, so a provider that sends
 * some and withholds the rest still resolves a whole profile.
 */
const PROFILE_CLAIMS = ["name", "email", "preferred_username", "picture"];

/**
 * The digest each signature algorithm's `at_hash` is taken with, per OpenID
 * Connect Core §3.1.3.6. An algorithm absent from this table leaves an `at_hash`
 * uncheckable, and an unverifiable binding is refused.
 */
const AT_HASH_DIGESTS: Record<string, typeof sha256> = {
	HS256: sha256,
	RS256: sha256,
	ES256: sha256,
	PS256: sha256,
	HS384: sha384,
	RS384: sha384,
	ES384: sha384,
	PS384: sha384,
	HS512: sha512,
	RS512: sha512,
	ES512: sha512,
	PS512: sha512,
	EdDSA: sha512,
};

/** The callback query string, which arrives from the browser and is untrusted. */
const CALLBACK_SCHEMA = s.object({
	code: s.optional(s.string()),
	state: s.optional(s.string()),
	error: s.optional(s.string()),
	error_description: s.optional(s.string()),
});

/** A successful token response, of which only `access_token` is guaranteed. */
const TOKEN_RESPONSE_SCHEMA = s.object({
	access_token: s.string(),
	token_type: s.optional(s.string()),
	expires_in: s.optional(s.number()),
	refresh_token: s.optional(s.string()),
	id_token: s.optional(s.string()),
	scope: s.optional(s.string()),
});

/** The `error`/`error_description` pair RFC 6749 §5.2 answers a refused grant with. */
const TOKEN_ERROR_SCHEMA = s.object({
	error: s.optional(s.string()),
	error_description: s.optional(s.string()),
});

/** The transaction as it is stored, re-read through the schema it was written with. */
const TRANSACTION_SCHEMA = s.object({
	state: s.string(),
	codeVerifier: s.string(),
	nonce: s.string(),
	returnTo: s.string(),
	acrValues: s.nullable(s.array(s.string())),
	maxAge: s.nullable(s.number()),
});

/** The userinfo response, whose `sub` binds it to the ID token beside it. */
const USER_INFO_SCHEMA = s.object({ sub: s.string() }, { unknownKeys: "passthrough" });

/**
 * Reads the session a request carries.
 *
 * @param ctx - The request context the session middleware wrote to.
 * @returns The request's session.
 * @throws When the session middleware has not run, which the login flow needs to
 *   keep the transaction on the server.
 */
function readSession(ctx: AuthSession.Context): Session {
	let session = ctx.get(Session);
	if (!session) {
		throw new Error("@sdxc/auth needs remix/middleware/session installed on the router");
	}
	return session;
}

/** A high-entropy opaque value, for the three correlation values a login needs. */
function correlationToken(): string {
	return randomToken({ bytes: RANDOM_TOKEN_BYTES });
}

/**
 * Derives the S256 PKCE challenge, the one method this class offers, so the
 * verifier stays on the server while its digest travels through the browser.
 *
 * @param verifier - The verifier held in the transaction.
 * @returns The challenge to publish on the authorization request.
 * @throws When the runtime declines the digest, which leaves PKCE unavailable and
 *   a login without it open to a code interception.
 */
async function deriveChallenge(verifier: string): Promise<string> {
	let digest = await sha256(verifier);

	if (isFailure(digest)) {
		throw new Error("@sdxc/auth needs a runtime whose WebCrypto computes SHA-256", {
			cause: digest.error,
		});
	}

	return Base64Url.encode(digest.data);
}

/**
 * Reads the `alg` a compact-serialized token declares, which selects the digest
 * its `at_hash` was taken with.
 *
 * @param raw - The compact-serialized token.
 * @returns The declared algorithm, or `null` for a token whose header is unreadable.
 */
function headerAlgorithm(raw: string): string | null {
	let segment = raw.split(".").at(0);
	if (!segment) return null;

	let decoded = Base64Url.decode(segment);
	if (isFailure(decoded)) return null;

	let header = wrap(() => JSON.parse(new TextDecoder().decode(decoded.data)) as unknown);
	if (isFailure(header)) return null;
	if (typeof header.data !== "object" || header.data === null) return null;

	let alg = (header.data as { alg?: unknown }).alg;
	return typeof alg === "string" ? alg : null;
}

/**
 * Computes an access token's `at_hash`: the left half of its digest, per OpenID
 * Connect Core §3.1.3.6.
 *
 * @param accessToken - The access token as the provider serialized it.
 * @param digest - The digest selected by the ID token's `alg`.
 * @throws When the runtime declines the digest, which leaves the binding
 *   unverifiable and the login refused. The fault is local, so it is reported as
 *   the environment failure it is rather than as a claim about the provider's token.
 */
async function computeAtHash(accessToken: string, digest: typeof sha256): Promise<string> {
	let hash = await digest(accessToken);

	if (isFailure(hash)) {
		throw new Error("@sdxc/auth needs a runtime whose WebCrypto computes the ID token's digest", {
			cause: hash.error,
		});
	}

	return Base64Url.encode(hash.data.subarray(0, hash.data.length / 2));
}

/**
 * Refuses caller-supplied values for the parameters this class writes itself.
 *
 * @param params - The extra parameters a caller asked to send.
 * @param reserved - The names this class owns.
 * @throws {AuthError} `reserved_parameter` naming the first parameter refused.
 */
function assertUnreserved(params: Record<string, string> | undefined, reserved: string[]): void {
	if (!params) return;

	for (let name of Object.keys(params)) {
		if (!reserved.includes(name)) continue;
		throw new AuthError(`\`${name}\` is set by the login flow and cannot be overridden`, {
			code: AuthErrorCode.ReservedParameter,
		});
	}
}

/** Compares two correlation values in time that depends only on their length. */
function equalTokens(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index++) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return difference === 0;
}

/** A duration in the seconds `max_age` and `expires_in` travel in. */
function inSeconds(value: number | DurationString): number {
	return typeof value === "string" ? toSeconds(value) : value;
}

/**
 * Builds the profile a `mapProfile` override replaces: the display claims OpenID
 * Connect defines, each answering the same nullability its ID-token accessor does.
 *
 * @param claims - The claim set the flow resolved.
 */
function defaultProfile(claims: JWT.Payload): RelyingParty.Profile {
	let token = new IdToken(claims);
	return {
		name: token.name,
		email: token.email,
		emailVerified: token.emailVerified,
		username: token.username,
		picture: token.picture,
	};
}

/**
 * A confidential OpenID Connect client for a person's browser login. Its three route
 * methods share one transaction, held in the session, so a callback is measured against
 * the `state`, PKCE verifier, `nonce`, and step-up its own login asked for.
 *
 * @template profile - What `mapProfile` produces, carried on the `Grant`.
 * @example
 * let rp = new RelyingParty(issuer, { clientId, clientSecret, redirectUri });
 * router.get(routes.auth.login, (ctx) => rp.authorize(ctx, { returnTo }));
 */
export class RelyingParty<profile = RelyingParty.Profile> implements AuthSession.Client {
	#issuer: Issuer;
	#clientId: string;
	#clientSecret: string | null;
	#redirectUri: string;
	#scopes: string[];
	#clientAuth: RelyingParty.ClientAuth;
	#userInfo: RelyingParty.UserInfoMode;
	#authorizationParams: Record<string, string>;
	#tokenParams: Record<string, string>;
	#mapProfile: (claims: JWT.Payload, tokens: RelyingParty.GrantedTokens) => profile;
	#subject: ((claims: JWT.Payload) => string) | null;
	#mfa: string[];
	#algorithms: JWK.Algorithm[] | undefined;
	#clockTolerance: number;
	#fallbackReturnTo: string;
	#rateLimit: Adapter | null;

	/**
	 * Binds a client's credentials to one issuer.
	 *
	 * @param issuer - The issuer this client is registered with.
	 * @param options - The client's credentials and its per-step overrides.
	 * @throws {AuthError} `reserved_parameter` when an extra parameter names one
	 *   the flow writes itself.
	 */
	constructor(issuer: Issuer, options: RelyingParty.Options<profile>) {
		assertUnreserved(options.authorizationParams, RESERVED_AUTHORIZATION_PARAMS);
		assertUnreserved(options.tokenParams, RESERVED_TOKEN_PARAMS);

		this.#issuer = issuer;
		this.#clientId = options.clientId;
		this.#clientSecret = options.clientSecret ?? null;
		this.#redirectUri = options.redirectUri.toString();
		this.#scopes = options.scopes ?? DEFAULT_SCOPES;
		this.#clientAuth = options.clientAuth ?? "client_secret_post";
		this.#userInfo = options.userInfo ?? "never";
		this.#authorizationParams = options.authorizationParams ?? {};
		this.#tokenParams = options.tokenParams ?? {};
		this.#mapProfile =
			options.mapProfile ?? ((claims) => defaultProfile(claims) as RelyingParty.Profile & profile);
		this.#subject = options.subject ?? null;
		this.#mfa = options.mfa ?? DEFAULT_MFA_VALUES;
		this.#algorithms = options.algorithms;
		this.#clockTolerance = options.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;
		this.#fallbackReturnTo = options.fallbackReturnTo ?? DEFAULT_RETURN_TO;
		this.#rateLimit = options.rateLimit ?? null;
	}

	/**
	 * Starts a login, spending the browser's budget before the session is touched, so a
	 * refused login leaves it as it was. `returnTo` resolves through `Location.safe`, taking
	 * the configured fallback for anything naming another origin.
	 *
	 * @param ctx - The request context the session middleware wrote to.
	 * @param options - Where to return to, and what to ask the issuer for.
	 * @returns The `303` redirect to the authorization endpoint.
	 * @throws {Response} `429` with `Retry-After` when the calling browser's login
	 *   budget is spent, which `catchResponse()` from `@sdxc/catch-response-middleware`
	 *   delivers as the reply.
	 * @throws {AuthError} `endpoint_unsupported` when the issuer publishes no
	 *   authorization endpoint, `reserved_parameter` for an extra parameter the flow
	 *   writes itself.
	 * @example
	 * router.get(routes.auth.login, (ctx) => rp.authorize(ctx, { returnTo }));
	 */
	async authorize(
		ctx: RelyingParty.Context,
		options: RelyingParty.AuthorizeOptions = {},
	): Promise<Response> {
		assertUnreserved(options.authorizationParams, RESERVED_AUTHORIZATION_PARAMS);

		await this.#spend(ctx);

		let session = readSession(ctx);
		let endpoint = await this.#issuer.authorizationEndpoint();

		let state = correlationToken();
		let nonce = correlationToken();
		let codeVerifier = correlationToken();
		let acrValues = options.acrValues ?? null;
		let maxAge = options.maxAge === undefined ? null : inSeconds(options.maxAge);

		let transaction: RelyingParty.Transaction = {
			state,
			codeVerifier,
			nonce,
			returnTo: Location.safe(options.returnTo, {
				origin: ctx.url.origin,
				fallback: this.#fallbackReturnTo,
			}).toString(),
			acrValues,
			maxAge,
		};

		session.set(TRANSACTION_SESSION_KEY, transaction);

		let url = new URL(endpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.#clientId);
		url.searchParams.set("redirect_uri", this.#redirectUri);
		url.searchParams.set("scope", (options.scopes ?? this.#scopes).join(" "));
		url.searchParams.set("state", state);
		url.searchParams.set("nonce", nonce);
		url.searchParams.set("code_challenge", await deriveChallenge(codeVerifier));
		url.searchParams.set("code_challenge_method", "S256");

		if (acrValues && acrValues.length > 0) url.searchParams.set("acr_values", acrValues.join(" "));
		if (maxAge !== null) url.searchParams.set("max_age", String(maxAge));
		if (options.prompt) url.searchParams.set("prompt", options.prompt);

		for (let [name, value] of Object.entries({
			...this.#authorizationParams,
			...options.authorizationParams,
		})) {
			url.searchParams.set(name, value);
		}

		return redirect(url.toString(), SEE_OTHER_STATUS);
	}

	/**
	 * Finishes a login and signs the request in. The transaction the callback is correlated
	 * against is spent the moment it is read, so one login answers exactly one callback.
	 *
	 * @param ctx - The request context the callback route received.
	 * @returns The verified tokens, the subject, the mapped profile, and where to go.
	 * @throws {AuthError} `authorization_failed`, `missing_transaction`,
	 *   `state_mismatch`, `missing_code`, `token_request_failed`,
	 *   `missing_id_token`, `invalid_token`, `nonce_mismatch`, `at_hash_mismatch`,
	 *   `acr_not_satisfied`, `max_age_not_satisfied`, or `user_info_failed`.
	 * @example
	 * let grant = await rp.callback(ctx);
	 * return redirect(grant.returnTo);
	 */
	async callback(ctx: AuthSession.Context): Promise<RelyingParty.Grant<profile>> {
		let session = readSession(ctx);
		let transaction = this.#takeTransaction(session);
		let params = this.#readCallback(ctx.url.searchParams);

		if (params.error) {
			throw new AuthError(`The issuer refused the authorization request: ${params.error}`, {
				code: AuthErrorCode.AuthorizationFailed,
				providerError: params.error,
				providerErrorDescription: params.error_description,
			});
		}

		if (!transaction) {
			throw new AuthError("The session holds no login transaction for this callback", {
				code: AuthErrorCode.MissingTransaction,
			});
		}

		if (!params.state || !equalTokens(params.state, transaction.state)) {
			throw new AuthError("The callback's `state` does not match the login it answers", {
				code: AuthErrorCode.StateMismatch,
			});
		}

		if (!params.code) {
			throw new AuthError("The callback carried neither a code nor an error", {
				code: AuthErrorCode.MissingCode,
			});
		}

		let response = await this.#requestToken(
			new URLSearchParams({
				grant_type: "authorization_code",
				code: params.code,
				redirect_uri: this.#redirectUri,
				code_verifier: transaction.codeVerifier,
			}),
		);

		if (!response.id_token) {
			throw new AuthError("The token response carried no ID token", {
				code: AuthErrorCode.MissingIdToken,
			});
		}

		let idToken = await this.#verifyIdToken(response.id_token, {
			nonce: transaction.nonce,
			accessToken: response.access_token,
		});

		this.#assertStepUp(idToken, transaction);

		let accessToken = AccessToken.decode(response.access_token);
		let refreshToken = response.refresh_token ?? null;
		let expiresAt =
			response.expires_in === undefined
				? null
				: Math.floor(Date.now() / MS_PER_SECOND) + response.expires_in;

		let claims = await this.#resolveClaims(idToken, response.access_token);

		session.regenerateId();
		AuthSession.write(ctx, {
			idToken: response.id_token,
			accessToken: response.access_token,
			refreshToken,
			expiresAt,
		});

		return {
			idToken,
			accessToken,
			refreshToken,
			returnTo: transaction.returnTo,
			subject: this.#subject ? this.#subject(claims) : idToken.subject,
			claims,
			profile: this.#mapProfile(claims, { idToken, accessToken, refreshToken }),
		};
	}

	/**
	 * Ends the login: drops this package's session state and hands the browser to
	 * the issuer, whose own session the `id_token_hint` identifies.
	 *
	 * @param ctx - The request context the logout route received.
	 * @param options - Where to come back to once the issuer has signed the person out.
	 * @returns The `303` redirect to the end-session endpoint.
	 * @throws {AuthError} `endpoint_unsupported` when the issuer publishes no
	 *   end-session endpoint.
	 * @example
	 * router.post(routes.auth.logout, (ctx) => rp.endSession(ctx, { returnTo: "/" }));
	 */
	endSession(
		ctx: AuthSession.Context,
		options?: RelyingParty.EndSessionOptions & { redirect?: true },
	): Promise<Response>;
	/**
	 * Ends the login and hands back the URL, for a caller that answers the request
	 * with a form, a page, or a redirect of its own.
	 *
	 * @param ctx - The request context the logout route received.
	 * @param options - Where to come back to, with `redirect` set to `false`.
	 * @returns The end-session URL the browser has to reach.
	 */
	endSession(
		ctx: AuthSession.Context,
		options: RelyingParty.EndSessionOptions & { redirect: false },
	): Promise<URL>;
	async endSession(
		ctx: AuthSession.Context,
		options: RelyingParty.EndSessionOptions = {},
	): Promise<Response | URL> {
		let session = readSession(ctx);
		let endpoint = await this.#issuer.endSessionEndpoint();

		let auth = AuthSession.from(ctx);
		let hint = auth?.tokens.idToken ?? null;

		auth?.clear();
		session.unset(TRANSACTION_SESSION_KEY);
		session.regenerateId(true);

		let returnTo = Location.safe(options.returnTo, {
			origin: ctx.url.origin,
			fallback: this.#fallbackReturnTo,
		});

		let url = new URL(endpoint);
		url.searchParams.set("client_id", this.#clientId);
		if (hint) url.searchParams.set("id_token_hint", hint);
		url.searchParams.set(
			"post_logout_redirect_uri",
			new URL(returnTo.toString(), ctx.url.origin).toString(),
		);

		if (options.redirect === false) return url;
		return redirect(url.toString(), SEE_OTHER_STATUS);
	}

	/**
	 * Verifies an ID token an app obtained outside the redirect flow — a native client,
	 * an IdP-initiated sign-in, a fixture. Runs every check the callback runs against the
	 * token itself, with this relying party's client id, algorithms, and skew.
	 *
	 * @param raw - The compact-serialized ID token.
	 * @returns The verified token.
	 * @throws {AuthError} `invalid_token` when any check on it fails.
	 * @example
	 * let idToken = await rp.verifyIdToken(request.headers.get("x-id-token")!);
	 */
	verifyIdToken(raw: string): Promise<IdToken> {
		return this.#verifyIdToken(raw, {});
	}

	/**
	 * Spends a refresh token on a renewed access token, verifying any ID token the
	 * response repeats before handing it back to be stored.
	 *
	 * @param refreshToken - The refresh token held in the session.
	 * @returns The renewed token set, where an omitted token keeps the stored one.
	 * @throws {AuthError} `token_request_failed` when the issuer refuses the grant,
	 *   `invalid_token` when a reissued ID token fails verification.
	 */
	async exchangeRefreshToken(refreshToken: string): Promise<AuthSession.Refreshed> {
		let response = await this.#requestToken(
			new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
		);

		if (response.id_token) {
			await this.#verifyIdToken(response.id_token, {});
		}

		return {
			idToken: response.id_token ?? null,
			accessToken: response.access_token,
			refreshToken: response.refresh_token ?? null,
			expiresAt:
				response.expires_in === undefined
					? null
					: Math.floor(Date.now() / MS_PER_SECOND) + response.expires_in,
		};
	}

	/**
	 * Whether the provider reported that more than one factor took part.
	 *
	 * Tests the configured values against `amr` and then `acr`, because a provider
	 * populates one or the other and the two carry the same answer.
	 *
	 * @param idToken - The ID token the login produced.
	 * @example
	 * if (!rp.mfa(auth.idToken)) throw redirect(href("/confirm-2fa"));
	 */
	mfa(idToken: IdToken): boolean {
		if (idToken.amr.some((method) => this.#mfa.includes(method))) return true;
		let acr = idToken.acr;
		return acr !== null && this.#mfa.includes(acr);
	}

	/**
	 * An `AuthScheme` for `remix/middleware/auth` that renews an access token past its
	 * expiry before the app's `verify` runs, signs out a session the provider refuses to
	 * renew, and keeps one that was never renewable on the claims it was written with.
	 *
	 * @param options - The app's `verify`, and the name the scheme reports.
	 * @returns The scheme to list in `auth({ schemes })`.
	 * @throws {AuthError} When the issuer cannot serve its own documents, so an outage stays
	 *   a fault the app answers rather than a person being signed out.
	 * @example
	 * rp.scheme({ verify: (auth) => users.getBySubject(auth.idToken.subject) });
	 */
	scheme<identity>(options: RelyingParty.SchemeOptions<identity>): AuthScheme<identity> {
		let authScheme: AuthScheme<identity> = {
			name: options.name ?? "oidc-session",

			/**
			 * Resolves the request's stored token set into the identity the app's `verify`
			 * returns, renewing the set first where it has reached its end.
			 *
			 * @param context - The request being authenticated.
			 * @returns The identity, the rejection, or nothing at all for a signed-out
			 *   request, which leaves the schemes behind this one their turn.
			 */
			authenticate: async (context): Promise<AuthSchemeAuthenticateResult<identity>> => {
				let auth = AuthSession.from(context);
				if (!auth) return null;

				if (auth.expired) {
					let refusal = await this.#renew(auth);
					if (refusal) return refusal;
				}

				let identity = await options.verify(auth);
				if (identity === null || identity === undefined) {
					return {
						status: "failure",
						code: "invalid_credentials",
						message: "The session's subject resolves to no identity in this app",
					};
				}

				return { status: "success", identity };
			},
		};

		return authScheme;
	}

	/**
	 * Renews a token set past its end, separating the two answers a refusal can carry: the
	 * provider declining a refresh token ends the session, while a set that carried none to
	 * present was never renewable, and stays signed in on claims verified when it was written.
	 *
	 * @param auth - The request's session, whose stored set has reached its end.
	 * @returns The refusal to answer the request with, and `null` where the request goes on
	 *   signed in — with a renewed set, or with the one it arrived carrying.
	 * @throws When the renewal failed for a reason outside the protocol, so an environment
	 *   fault reaches the app rather than being read as a session that is over.
	 */
	async #renew(auth: AuthSession): Promise<AuthSchemeFailure | null> {
		let renewed = await wrap(() => auth.refresh(this));
		if (!isFailure(renewed)) return null;
		if (AuthError.is(renewed.error, AuthErrorCode.MissingRefreshToken)) return null;
		if (!(renewed.error instanceof AuthError)) throw renewed.error;

		auth.clear();

		return {
			status: "failure",
			code: "invalid_credentials",
			message: renewed.error.message,
		};
	}

	/**
	 * Spends one unit of the calling browser's budget for starting a login. A backend that
	 * cannot answer lets the attempt through, so people keep signing in through a limiter
	 * outage, and the issuer enforces its own limit on every request it sees.
	 *
	 * @param ctx - The request context the login starts from.
	 * @throws {Response} `429` carrying `Retry-After` and the quota fields, which
	 *   `catchResponse()` answers the request with.
	 */
	async #spend(ctx: RelyingParty.Context): Promise<void> {
		if (!this.#rateLimit) return;

		let clientIp = getClientIP(ctx.request) ?? UNKNOWN_CLIENT_IP;
		let result = await this.#rateLimit.consume(`${RATE_LIMIT_PREFIX}:${clientIp}`);
		if (isFailure(result)) return;
		if (result.data.allowed) return;

		throw applyRateLimitHeaders(
			new Response(RATE_LIMITED_BODY, {
				status: RATE_LIMITED_STATUS,
				headers: { "content-type": "text/plain; charset=utf-8" },
			}),
			result.data,
			this.#rateLimit.window,
		);
	}

	/**
	 * Reads the callback's query string, which arrives from the browser.
	 *
	 * @param searchParams - The callback URL's parameters.
	 * @returns The parameters OAuth defines for the response, of which a response
	 *   carries at least one.
	 * @throws {AuthError} `authorization_failed` when the query string holds none of
	 *   them readably, so an operator reads the shape of what arrived rather than a
	 *   correlation failure standing in for it.
	 */
	#readCallback(searchParams: URLSearchParams): s.InferOutput<typeof CALLBACK_SCHEMA> {
		let parsed = s.parseSafe(CALLBACK_SCHEMA, Object.fromEntries(searchParams));

		if (parsed.success && (parsed.value.code || parsed.value.state || parsed.value.error)) {
			return parsed.value;
		}

		throw new AuthError("The callback's query string is not an authorization response", {
			code: AuthErrorCode.AuthorizationFailed,
			cause: parsed.success ? undefined : parsed.issues,
		});
	}

	/**
	 * Reads the transaction and spends it in the same step, so each login is
	 * answerable by exactly one callback.
	 *
	 * @param session - The request's session.
	 * @returns The transaction, or `null` when the session holds none.
	 */
	#takeTransaction(session: Session): RelyingParty.Transaction | null {
		let stored = session.get(TRANSACTION_SESSION_KEY);
		session.unset(TRANSACTION_SESSION_KEY);
		if (stored === undefined) return null;

		let parsed = s.parseSafe(TRANSACTION_SCHEMA, stored);
		return parsed.success ? parsed.value : null;
	}

	/**
	 * Presents the client's credentials at the token endpoint and reads the answer.
	 *
	 * @param body - The grant-specific parameters.
	 * @returns The validated token response.
	 * @throws {AuthError} `endpoint_unsupported` when the issuer advertises no token
	 *   endpoint, `token_request_failed` when it refuses the grant, declares a media
	 *   type other than JSON, or answers something other than a token response.
	 */
	async #requestToken(body: URLSearchParams): Promise<s.InferOutput<typeof TOKEN_RESPONSE_SCHEMA>> {
		let endpoint = await this.#issuer.tokenEndpoint();

		for (let [name, value] of Object.entries(this.#tokenParams)) body.set(name, value);

		let headers = new Headers({
			"content-type": "application/x-www-form-urlencoded",
			accept: "application/json",
		});

		if (this.#clientAuth === "client_secret_basic") {
			let credentials = `${encodeURIComponent(this.#clientId)}:${encodeURIComponent(this.#clientSecret ?? "")}`;
			headers.set("authorization", `Basic ${Base64.encode(credentials)}`);
		} else {
			body.set("client_id", this.#clientId);
			if (this.#clientSecret) body.set("client_secret", this.#clientSecret);
		}

		let response = await fetch(endpoint, { method: "POST", headers, body });

		let mediaType = nonJsonMediaType(response);

		if (mediaType !== null) {
			throw new AuthError(`The token endpoint answered with ${mediaType} instead of JSON`, {
				code: AuthErrorCode.TokenRequestFailed,
			});
		}

		let answer = await wrap(() => response.json() as Promise<unknown>);

		if (isFailure(answer)) {
			throw new AuthError("The token endpoint answered with something other than JSON", {
				code: AuthErrorCode.TokenRequestFailed,
				cause: answer.error,
			});
		}

		if (!response.ok) {
			let refusal = s.parseSafe(TOKEN_ERROR_SCHEMA, answer.data);
			throw new AuthError(`The token endpoint refused the grant with ${response.status}`, {
				code: AuthErrorCode.TokenRequestFailed,
				providerError: refusal.success ? refusal.value.error : undefined,
				providerErrorDescription: refusal.success ? refusal.value.error_description : undefined,
			});
		}

		let parsed = s.parseSafe(TOKEN_RESPONSE_SCHEMA, answer.data);
		if (!parsed.success) {
			throw new AuthError("The token endpoint's response is missing an access token", {
				code: AuthErrorCode.TokenRequestFailed,
			});
		}

		return parsed.value;
	}

	/**
	 * Puts an ID token through the issuer's verification, then the bindings only this
	 * flow knows: the `nonce` the transaction held, and the access token an `at_hash`
	 * commits to.
	 *
	 * @param raw - The compact-serialized ID token.
	 * @param bindings - The transaction's `nonce` and the access token beside this one.
	 * @returns The verified token.
	 * @throws {AuthError} `invalid_token`, `nonce_mismatch`, or `at_hash_mismatch`.
	 */
	async #verifyIdToken(
		raw: string,
		bindings: { nonce?: string; accessToken?: string },
	): Promise<IdToken> {
		let idToken = await this.#issuer.verifyIdToken(raw, {
			audience: this.#clientId,
			algorithms: this.#algorithms,
			clockTolerance: this.#clockTolerance,
		});

		if (bindings.nonce !== undefined) {
			let nonce = idToken.nonce;
			if (!nonce || !equalTokens(nonce, bindings.nonce)) {
				throw new AuthError("The ID token's `nonce` does not match the login it answers", {
					code: AuthErrorCode.NonceMismatch,
				});
			}
		}

		let atHash = idToken.atHash;
		if (bindings.accessToken !== undefined && atHash) {
			let alg = headerAlgorithm(raw);
			let digest = alg === null ? undefined : AT_HASH_DIGESTS[alg];

			if (!digest) {
				throw new AuthError(`The ID token's \`at_hash\` cannot be checked for alg ${alg}`, {
					code: AuthErrorCode.InvalidToken,
				});
			}

			let expected = await computeAtHash(bindings.accessToken, digest);
			if (!equalTokens(atHash, expected)) {
				throw new AuthError("The ID token's `at_hash` names a different access token", {
					code: AuthErrorCode.AtHashMismatch,
				});
			}
		}

		return idToken;
	}

	/**
	 * Holds the response to what the request asked for. A provider is free to answer
	 * a step-up request with a token carrying none of the claims it asked for, so the
	 * request stops here with the reason an app can act on.
	 *
	 * @param idToken - The verified ID token.
	 * @param transaction - The login the token answers, carrying what was asked.
	 * @throws {AuthError} `acr_not_satisfied` when no requested authentication
	 *   context came back, `max_age_not_satisfied` when `auth_time` is absent or
	 *   older than the window.
	 */
	#assertStepUp(idToken: IdToken, transaction: RelyingParty.Transaction): void {
		let acrValues = transaction.acrValues;

		if (acrValues && acrValues.length > 0) {
			let acr = idToken.acr;
			let satisfied =
				(acr !== null && acrValues.includes(acr)) ||
				idToken.amr.some((method) => acrValues.includes(method));

			if (!satisfied) {
				throw new AuthError(
					`The ID token reports no authentication context among ${acrValues.join(" ")}`,
					{ code: AuthErrorCode.AcrNotSatisfied },
				);
			}
		}

		if (transaction.maxAge === null) return;

		let authTime = idToken.authTime;
		if (!authTime) {
			throw new AuthError("The ID token carries no `auth_time` for the requested `max_age`", {
				code: AuthErrorCode.MaxAgeNotSatisfied,
			});
		}

		let age = (Date.now() - authTime.getTime()) / MS_PER_SECOND;
		if (age > transaction.maxAge + this.#clockTolerance) {
			throw new AuthError("The person authenticated longer ago than the requested `max_age`", {
				code: AuthErrorCode.MaxAgeNotSatisfied,
			});
		}
	}

	/**
	 * Resolves the claim set a profile is built from: the verified ID token, plus a userinfo
	 * round-trip where `"when-missing"` finds a display claim absent, whose answer OpenID
	 * Connect Core §5.3.2 binds to the login by its `sub`.
	 *
	 * @param idToken - The verified ID token.
	 * @param accessToken - The access token to present at the userinfo endpoint.
	 * @returns The ID token's claims, with any userinfo claims layered over them.
	 * @throws {AuthError} `endpoint_unsupported`, `user_info_failed` when the
	 *   userinfo endpoint declares a media type other than JSON or answers unusably,
	 *   `invalid_token` when its `sub` names someone else.
	 */
	async #resolveClaims(idToken: IdToken, accessToken: string): Promise<JWT.Payload> {
		if (this.#userInfo === "never") return idToken.payload;

		if (this.#userInfo === "when-missing") {
			let complete = PROFILE_CLAIMS.every((claim) => idToken.payload[claim] !== undefined);
			if (complete) return idToken.payload;
		}

		let endpoint = await this.#issuer.userInfoEndpoint();
		let response = await fetch(endpoint, {
			headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
		});

		let mediaType = nonJsonMediaType(response);

		if (mediaType !== null) {
			throw new AuthError(`The userinfo endpoint answered with ${mediaType} instead of JSON`, {
				code: AuthErrorCode.UserInfoFailed,
			});
		}

		let claims = await wrap(() => response.json() as Promise<unknown>);

		if (isFailure(claims)) {
			throw new AuthError("The userinfo endpoint answered with something other than JSON", {
				code: AuthErrorCode.UserInfoFailed,
				cause: claims.error,
			});
		}

		if (!response.ok) {
			throw new AuthError(`The userinfo endpoint answered ${response.status}`, {
				code: AuthErrorCode.UserInfoFailed,
			});
		}

		let parsed = s.parseSafe(USER_INFO_SCHEMA, claims.data);
		if (!parsed.success) {
			throw new AuthError("The userinfo response carries no `sub` to bind it to the login", {
				code: AuthErrorCode.InvalidToken,
			});
		}

		if (parsed.value.sub !== idToken.subject) {
			throw new AuthError("The userinfo response names a different subject than the ID token", {
				code: AuthErrorCode.InvalidToken,
			});
		}

		return { ...idToken.payload, ...parsed.value };
	}
}

export namespace RelyingParty {
	/**
	 * What starting a login reads from the request context: the session middleware's
	 * entry, and the request itself, whose edge headers name the browser the login
	 * is counted against.
	 */
	export interface Context extends AuthSession.Context {
		/** Read for the connecting client's IP whenever a budget is configured. */
		readonly request: Request;
	}

	/** How the client presents its secret at the token endpoint. */
	export type ClientAuth = "client_secret_post" | "client_secret_basic";

	/**
	 * When the flow spends a round-trip on the userinfo endpoint. `"when-missing"`
	 * spends it whenever the ID token withholds any display claim, so a claim an app
	 * authorizes on arrives whole rather than empty.
	 */
	export type UserInfoMode = "never" | "always" | "when-missing";

	/** The values `prompt` takes, per OpenID Connect Core §3.1.2.1. */
	export type Prompt = "none" | "login" | "consent" | "select_account" | (string & {});

	/** The display claims a login resolves when the app maps no profile of its own. */
	export interface Profile {
		/** The person's display name, sent with the `profile` scope. */
		name: string | null;
		/** The person's email address, sent with the `email` scope. */
		email: string | null;
		/** Whether the provider vouches for the email address. */
		emailVerified: boolean;
		/** The `preferred_username` claim, display-only and mutable at the provider. */
		username: string | null;
		/** The avatar the provider publishes, as the string it publishes it as. */
		picture: string | null;
	}

	/** The tokens a `mapProfile` override is handed alongside the claims. */
	export interface GrantedTokens {
		/** The verified ID token. */
		idToken: IdToken;
		/** The access token the grant issued. */
		accessToken: AccessToken;
		/** The refresh token, when the grant included one. */
		refreshToken: string | null;
	}

	/** A client's credentials and the overrides that shape each step of its flow. */
	export interface Options<profile = Profile> {
		/** The client identifier registered with the issuer. */
		clientId: string;
		/** The client secret, for a confidential client. */
		clientSecret?: string;
		/** The callback URL registered with the issuer, sent on both legs of the flow. */
		redirectUri: string | URL;
		/**
		 * The scopes a login asks for.
		 *
		 * @default ["openid", "profile", "email"]
		 */
		scopes?: string[];
		/**
		 * How the secret is presented at the token endpoint.
		 *
		 * @default "client_secret_post"
		 */
		clientAuth?: ClientAuth;
		/**
		 * When claims are read from the userinfo endpoint. The default leans on the
		 * verified ID token, which a login already holds. `"when-missing"` reaches for
		 * userinfo unless the ID token carries every display claim.
		 *
		 * @default "never"
		 */
		userInfo?: UserInfoMode;
		/** Extra authorization parameters, sent on every login this client starts. */
		authorizationParams?: Record<string, string>;
		/** Extra token parameters, sent on every grant this client requests. */
		tokenParams?: Record<string, string>;
		/**
		 * Builds the profile carried on the `Grant`.
		 *
		 * The subject is resolved separately, which keeps a mutable claim such as
		 * `email` out of the value an app recognizes an account by.
		 *
		 * @param claims - The resolved claim set.
		 * @param tokens - The tokens the grant issued.
		 */
		mapProfile?: (claims: JWT.Payload, tokens: GrantedTokens) => profile;
		/**
		 * Resolves the identity anchor from the claim set, for an issuer whose stable
		 * identifier lives in a claim other than `sub`.
		 *
		 * @param claims - The resolved claim set.
		 */
		subject?: (claims: JWT.Payload) => string;
		/**
		 * The `amr` and `acr` values that count as more than one factor.
		 *
		 * @default ["mfa"]
		 */
		mfa?: string[];
		/** The signature algorithms an ID token from this issuer may be signed with. */
		algorithms?: JWK.Algorithm[];
		/**
		 * Seconds of clock skew tolerated on the lifetime claims and on `max_age`.
		 *
		 * @default 60
		 */
		clockTolerance?: number;
		/**
		 * Where a login returns to when the caller named nothing, or named something
		 * that resolves off this app's origin.
		 *
		 * @default "/"
		 */
		fallbackReturnTo?: string;
		/**
		 * The budget every login start is counted against, keyed by the connecting
		 * client's IP, which is what keeps a scripted flood of login redirects off the
		 * issuer. Configuring one makes `authorize` throw a `429` response.
		 */
		rateLimit?: Adapter;
	}

	/** What one login asks the issuer for, beyond the client's standing options. */
	export interface AuthorizeOptions {
		/**
		 * Where to return to once the login finishes, kept when it resolves to this
		 * app's own origin and replaced by the client's fallback otherwise.
		 */
		returnTo?: string | URL | Location | null;
		/** The scopes this login asks for, in place of the client's. */
		scopes?: string[];
		/**
		 * The authentication context classes this login requires, sent as
		 * `acr_values`. The callback refuses a response that reports none of them.
		 */
		acrValues?: string[];
		/**
		 * How recently the person has to have authenticated, sent as `max_age`. A
		 * number counts seconds, the unit the parameter travels in. The callback
		 * refuses a response whose `auth_time` is absent or outside the window.
		 */
		maxAge?: number | DurationString;
		/** What the issuer is asked to do about an existing session, sent as `prompt`. */
		prompt?: Prompt;
		/** Extra authorization parameters, for this login alone. */
		authorizationParams?: Record<string, string>;
	}

	/** Where a logout comes back to, and whether it answers with the redirect. */
	export interface EndSessionOptions {
		/**
		 * Where the issuer sends the browser once it has signed the person out, sent
		 * as `post_logout_redirect_uri` and held to this app's own origin.
		 */
		returnTo?: string | URL | Location | null;
		/**
		 * Whether to answer the request with the redirect.
		 *
		 * @default true
		 */
		redirect?: boolean;
	}

	/** What a completed login produces. */
	export interface Grant<profile = Profile> {
		/** The verified ID token. */
		idToken: IdToken;
		/** The access token the grant issued. */
		accessToken: AccessToken;
		/** The refresh token, when the grant included one. */
		refreshToken: string | null;
		/** Where to send the browser, already held to this app's own origin. */
		returnTo: string;
		/** The identity anchor an app keys its own records on. */
		subject: string;
		/** The claim set the flow resolved, for an app that reads claims directly. */
		claims: JWT.Payload;
		/** The profile the app's own mapping produced. */
		profile: profile;
	}

	/** How the scheme turns a signed-in session into the app's identity. */
	export interface SchemeOptions<identity> {
		/**
		 * Resolves the app's identity from the session's tokens.
		 *
		 * @param auth - The signed-in session, holding a live access token.
		 * @returns The identity, or `null` for a subject this app knows nothing about.
		 */
		verify(auth: AuthSession): Promise<identity | null | undefined> | identity | null | undefined;
		/**
		 * The name reported as `auth.method`.
		 *
		 * @default "oidc-session"
		 */
		name?: string;
	}

	/**
	 * A login in flight, held in the session for the one callback that answers it.
	 * Every field is server-written, and every field is compared against the
	 * response before the response is believed.
	 */
	export interface Transaction {
		/** The value the callback has to echo for this login to be its answer. */
		state: string;
		/** The PKCE verifier, presented at the token endpoint to claim the code. */
		codeVerifier: string;
		/** The value the ID token has to carry to belong to this login. */
		nonce: string;
		/** Where the login returns to, already held to this app's own origin. */
		returnTo: string;
		/** The authentication contexts this login required, for the callback to hold. */
		acrValues: string[] | null;
		/** The authentication age this login required, in seconds. */
		maxAge: number | null;
	}
}
