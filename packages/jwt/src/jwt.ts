/**
 * A JWT payload as an object with typed accessors, meant to be subclassed.
 *
 * A decoded token is a bag of `unknown`, and reading claims straight off it spreads
 * the same string literals and the same type checks across every call site. `JWT`
 * gives each kind of token a class instead: the registered claims arrive as getters,
 * an application adds its own on top through `this.parser`, and signing, verifying,
 * and decoding all produce an instance of that class.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationString } from "@sdxc/duration";

import { toSeconds } from "@sdxc/duration";
import * as jose from "jose";

import type { JWK } from "./jwk";

import { ObjectParser } from "./lib/parser";

/** Milliseconds in a second, for converting between epoch claims and `Date`. */
const MS_PER_SECOND = 1000;

/** Claims that may be written as a length of time from now. */
const RELATIVE_CLAIMS = ["exp", "iat", "nbf"] as const;

/**
 * Resolves any claim written as a length of time into the instant it names.
 * A duration is measured from now, so `exp: "1h"` is an hour from now, and a
 * number stays seconds since the epoch; the claim set copies only when needed.
 *
 * @param payload - The claims as written.
 * @returns The claims with every time claim as seconds since the epoch.
 */
function resolveRelativeClaims(payload: JWT.PayloadInput): JWT.Payload {
	let relative = RELATIVE_CLAIMS.filter((claim) => typeof payload[claim] === "string");
	if (relative.length === 0) return payload as JWT.Payload;

	let resolved = { ...payload } as JWT.Payload;
	let now = Math.floor(Date.now() / MS_PER_SECOND);

	for (let claim of relative) resolved[claim] = now + toSeconds(payload[claim] as DurationString);

	return resolved;
}

/**
 * A JWT payload, with the registered claims exposed as typed accessors.
 *
 * Subclass it to add accessors for claims beyond the registered set; an
 * instance proxies to `payload`, so an accessor-less claim still reads by name.
 *
 * @example
 * class IdToken extends JWT {
 * 	override get subject() {
 * 		return this.parser.string("sub"); // required here, so `string` not `string | null`
 * 	}
 *
 * 	get email() {
 * 		return this.parser.string("email");
 * 	}
 * }
 */
export class JWT implements jose.JWTPayload {
	/** The raw claim set, readable whole for callers that want the payload itself. */
	readonly payload: JWT.Payload;

	/** Type-checked reads over `payload`, for the accessors a subclass defines. */
	protected parser: ObjectParser;

	/**
	 * Any claim, by name, for the ones no accessor covers.
	 *
	 * Required to satisfy `jose.JWTPayload`, and it is what the proxy below fills in.
	 */
	[propName: string]: unknown;

	/**
	 * Wraps a claim set in a proxy: a claim with no accessor still reads through
	 * to the payload, and assigning an unknown property lands there too, so a
	 * missing claim answers `null` and callers can test for it directly.
	 *
	 * @param payload - The claims, defaulting to an empty set so a token can be built
	 *   up through the setters.
	 * @example
	 * let jwt = new JWT({ sub: "user-123" });
	 * jwt.subject; // "user-123"
	 */
	constructor(payload: JWT.PayloadInput = {}) {
		this.payload = resolveRelativeClaims(payload);
		this.parser = new ObjectParser(this.payload);

		return new Proxy(this, {
			get(self, prop) {
				if (prop in self) return Reflect.get(self, prop);
				if (typeof prop === "string" && self.parser.has(prop)) return self.parser.get(prop);
				return null;
			},

			set(self, prop, value) {
				if (prop in self) return Reflect.set(self, prop, value);
				if (typeof prop === "string") {
					self.payload[prop] = value;
					return true;
				}
				return Reflect.set(self, prop, value);
			},
		});
	}

	/**
	 * The `aud` claim: who the token is for.
	 *
	 * @returns One audience, several, or `null` when the claim is absent or malformed.
	 */
	get audience(): string | string[] | null {
		if (!this.parser.has("aud")) return null;
		let value = this.parser.get("aud");
		if (typeof value === "string") return value;
		if (Array.isArray(value)) return value as string[];
		return null;
	}

	/** @param value - The audience to set, or `null` to drop the claim. */
	set audience(value: string | string[] | null) {
		this.payload.aud = value ?? undefined;
	}

	/**
	 * The `exp` claim, as stored.
	 *
	 * @returns The raw claim value, or `null` when the token does not expire.
	 */
	get expirationTime(): number | null {
		if (this.parser.has("exp")) return this.parser.number("exp");
		return null;
	}

	/** @param value - The expiration to set, or `null` to drop the claim. */
	set expirationTime(value: number | null) {
		this.payload.exp = value ?? undefined;
	}

	/**
	 * How many seconds are left before the token expires.
	 *
	 * Counted in the seconds RFC 7519 stores `exp` in, so the number is a length of
	 * time and goes negative once the token is past its expiry.
	 *
	 * @returns The seconds until `exp`, or `null` when the claim is absent.
	 */
	get expiresIn(): number | null {
		if (this.expirationTime === null) return null;
		return this.expirationTime - Math.floor(Date.now() / MS_PER_SECOND);
	}

	/**
	 * The expiration as a `Date`.
	 *
	 * @returns The expiry, or `null` when the token does not expire.
	 */
	get expiresAt(): Date | null {
		if (this.expirationTime === null) return null;
		return new Date(this.expirationTime * MS_PER_SECOND);
	}

	/**
	 * Whether the token is past its expiry, by this class's reading of `exp`.
	 *
	 * A convenience for display and for cache decisions. `JWT.verify` is what enforces
	 * `exp`, against the units the RFC defines.
	 *
	 * @returns `false` for a token with no `exp`, since nothing says it has expired.
	 */
	get expired(): boolean {
		if (this.expiresIn === null) return false;
		return this.expiresIn <= 0;
	}

	/**
	 * The `iat` claim: when the token was issued.
	 *
	 * @returns The issuance time, or `null` when the claim is absent.
	 */
	get issuedAt(): Date | null {
		if (this.parser.has("iat")) return new Date(this.parser.number("iat"));
		return null;
	}

	/** @param value - The issuance time to set, or `null` to drop the claim. */
	set issuedAt(value: Date | null) {
		this.payload.iat = value ? Math.floor(value.getTime() / MS_PER_SECOND) : undefined;
	}

	/**
	 * The `iss` claim: who issued the token.
	 *
	 * @returns The issuer, or `null` when the claim is absent.
	 */
	get issuer(): string | null {
		if (this.parser.has("iss")) return this.parser.string("iss");
		return null;
	}

	/** @param value - The issuer to set, or `null` to drop the claim. */
	set issuer(value: string | null) {
		this.payload.iss = value ?? undefined;
	}

	/**
	 * The `jti` claim: the token's unique identifier.
	 *
	 * @returns The identifier, or `null` when the claim is absent.
	 */
	get id(): string | null {
		if (this.parser.has("jti")) return this.parser.string("jti");
		return null;
	}

	/** @param value - The identifier to set, or `null` to drop the claim. */
	set id(value: string | null) {
		this.payload.jti = value ?? undefined;
	}

	/**
	 * The `nbf` claim: when the token starts being valid.
	 *
	 * @returns The start of validity, or `null` when the claim is absent.
	 */
	get notBefore(): Date | null {
		if (this.parser.has("nbf")) return new Date(this.parser.number("nbf"));
		return null;
	}

	/** @param value - The start of validity to set, or `null` to drop the claim. */
	set notBefore(value: Date | null) {
		this.payload.nbf = value ? Math.floor(value.getTime() / MS_PER_SECOND) : undefined;
	}

	/**
	 * The `sub` claim: who the token is about.
	 *
	 * @returns The subject, or `null` when the claim is absent.
	 */
	get subject(): string | null {
		if (this.parser.has("sub")) return this.parser.string("sub");
		return null;
	}

	/** @param value - The subject to set, or `null` to drop the claim. */
	set subject(value: string | null) {
		this.payload.sub = value ?? undefined;
	}

	/**
	 * Signs this token.
	 *
	 * @param algorithm - Algorithm to sign with; also selects the key.
	 * @param jwks - Candidate keys, newest first.
	 * @returns The compact-serialized token.
	 * @example
	 * let signed = await token.sign(JWK.Algorithm.ES256, await JWK.signingKeys(storage));
	 */
	sign(algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string> {
		return JWT.sign(this, algorithm, jwks);
	}

	/**
	 * The claims a subclass exposes, as a plain object.
	 *
	 * Reads the getters declared directly on the instance's own prototype, so what
	 * comes out is the subclass's view of the token: the claims it models.
	 *
	 * @returns Each own getter's name mapped to its value.
	 */
	toJSON(): Record<string, unknown> {
		let descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this));
		let keys = Object.keys(descriptors).filter(
			(key) => typeof descriptors[key]?.get === "function",
		);

		return keys.reduce<Record<string, unknown>>((acc, key) => {
			acc[key] = this[key];
			return acc;
		}, {});
	}

	/**
	 * Signs a token with the first key matching the algorithm.
	 *
	 * The keys arrive newest first, so the newest signs while older ones stay
	 * published to verify what they already signed, keyed by the `kid` header.
	 *
	 * @param jwt - The token to sign.
	 * @param algorithm - Algorithm to sign with; also selects the key.
	 * @param jwks - Candidate keys, newest first.
	 * @returns The compact-serialized token.
	 * @throws When no key in the set was generated for that algorithm.
	 */
	static sign(jwt: JWT, algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string> {
		let key = jwks.find((candidate) => candidate.alg === algorithm);
		if (!key) throw new Error(`No key available to sign JWT with algorithm ${algorithm}`);

		return new jose.SignJWT(jwt.payload)
			.setProtectedHeader({ alg: algorithm, typ: "JWT", kid: key.id })
			.sign(key.private);
	}

	/**
	 * Verifies a token and returns it as an instance of the class this was called on.
	 *
	 * The key is picked by the token's `kid`, letting a retired key keep verifying
	 * what it already signed through a rotation; `algorithms` pins accepted ones.
	 *
	 * @param token - The compact-serialized token.
	 * @param jwks - The keys themselves, or a resolver from `JWK.importLocal` /
	 *   `JWK.importRemote`. Keys given directly are wrapped into a local key set so
	 *   they go through the same per-token `kid` selection a resolver would apply.
	 * @param options - Expected issuer, audience, algorithms, clock tolerance, and so on.
	 * @returns The verified token.
	 * @throws When the set offers no key for the token, or when a check on it fails.
	 * @example
	 * let idToken = await IdToken.verify(raw, keys, {
	 * 	issuer,
	 * 	audience: clientId,
	 * 	algorithms: [JWK.Algorithm.ES256],
	 * });
	 */
	static async verify<M extends JWT>(
		this: new (payload: JWT.Payload) => M,
		token: string,
		jwks: JWK.VerificationKeys,
		options?: JWT.VerifyOptions,
	): Promise<M> {
		if (Array.isArray(jwks) && jwks.length === 0) {
			throw new Error("No key available to verify JWT");
		}

		let key = Array.isArray(jwks)
			? jose.createLocalJWKSet({ keys: jwks.map((candidate) => candidate.jwk) })
			: jwks;

		let result = await jose.jwtVerify(token, key, options);

		return new this(result.payload);
	}

	/**
	 * Reads a token's claims as the token presents them, prior to verification.
	 *
	 * Use it to decide how to verify a token — reading `iss` to pick a JWKS, for
	 * instance — and let `verify` be what every decision about the request rests on.
	 *
	 * @param token - The compact-serialized token.
	 * @returns The decoded token, as an instance of the class this was called on.
	 */
	static decode<M extends JWT>(this: new (payload: JWT.Payload) => M, token: string): M {
		return new this(jose.decodeJwt(token));
	}
}

export namespace JWT {
	/** A JWT claim set, with every time claim as the seconds since the epoch. */
	export type Payload = jose.JWTPayload;

	/**
	 * A claim set as it may be written, where a time claim can be a length of time.
	 *
	 * `exp: "1h"` is an hour from the moment the token is built; a number stays
	 * seconds since the epoch. Either way, `payload` holds the resolved seconds.
	 */
	export type PayloadInput = Omit<Payload, "exp" | "iat" | "nbf"> & {
		exp?: number | DurationString;
		iat?: number | DurationString;
		nbf?: number | DurationString;
	};

	/** The checks `JWT.verify` can be asked to run beyond the signature. */
	export type VerifyOptions = jose.JWTVerifyOptions;
}
