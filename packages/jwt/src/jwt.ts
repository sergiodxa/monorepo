/**
 * A JWT payload as an object with typed accessors, meant to be subclassed.
 *
 * A decoded token is a bag of `unknown`, and reading claims straight off it spreads
 * the same string literals and the same type checks across every call site. `JWT`
 * gives each kind of token a class instead: the registered claims arrive as getters,
 * an application adds its own on top through `this.parser`, and signing, verifying,
 * and decoding all produce that class rather than a plain object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as jose from "jose";

import type { JWK } from "./jwk";

import { ObjectParser } from "./lib/parser";

/** Milliseconds in a second, for converting between epoch claims and `Date`. */
const MS_PER_SECOND = 1000;

/**
 * A JWT payload, with the registered claims exposed as typed accessors.
 *
 * Subclass it to describe a specific kind of token, overriding the accessors whose
 * claims that token guarantees and adding the ones it carries beyond the registered
 * set:
 *
 * ```ts
 * class IdToken extends JWT {
 * 	override get subject() {
 * 		return this.parser.string("sub"); // required here, so `string` not `string | null`
 * 	}
 *
 * 	get email() {
 * 		return this.parser.string("email");
 * 	}
 * }
 * ```
 *
 * Instances are proxied, so a claim with no accessor is still readable by name and
 * returns `null` when absent — which is what lets a caller reach for `payload` and a
 * subclass reach for its getters on the very same object.
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
	 * Wraps a claim set.
	 *
	 * @param payload - The claims, defaulting to an empty set so a token can be built
	 *   up through the setters.
	 * @example
	 * let jwt = new JWT({ sub: "user-123" });
	 * jwt.subject; // "user-123"
	 */
	constructor(payload: JWT.Payload = {}) {
		this.payload = payload;
		this.parser = new ObjectParser(payload);

		// Returning a proxy from the constructor is what makes an instance behave like
		// the payload it wraps: a claim with no accessor reads through to the payload
		// instead of being `undefined`, and assigning an unknown property writes into
		// the payload so it is carried into the signature. Without this, a token class
		// would have to declare an accessor for every claim it merely passes along.
		return new Proxy(this, {
			get(self, prop) {
				if (prop in self) return Reflect.get(self, prop);
				// Absent rather than thrown: an unrecognized claim is a normal thing to
				// ask about, and callers test the result rather than catching.
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
	 * How long is left before the token expires.
	 *
	 * Beware the units: this subtracts `Date.now()`, in milliseconds, from `exp`, which
	 * RFC 7519 defines in seconds, so the number is only meaningful for a token whose
	 * `exp` was written in milliseconds. It is preserved as-is because the token
	 * classes that care override it, and because `expired` is built on it — changing
	 * the units here would silently change which tokens are treated as expired.
	 *
	 * @returns The difference between `exp` and now, or `null` when absent.
	 */
	get expiresIn(): number | null {
		if (this.parser.has("exp")) return this.parser.number("exp") - Date.now();
		return null;
	}

	/**
	 * The expiration as a `Date`, built from `exp` read as milliseconds.
	 *
	 * @returns The expiry, or `null` when the token does not expire.
	 */
	get expiresAt(): Date | null {
		if (this.expirationTime) return new Date(this.expirationTime);
		return null;
	}

	/**
	 * Whether the token is past its expiry, by this class's reading of `exp`.
	 *
	 * This is a convenience for display and for cache decisions, not an authorization
	 * check — `JWT.verify` is what enforces `exp`, against the units the RFC defines.
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
	 * let signed = await token.sign(JWK.Algoritm.ES256, await JWK.signingKeys(storage));
	 */
	sign(algorithm: JWK.Algoritm, jwks: JWK.SigningKey[]): Promise<string> {
		return JWT.sign(this, algorithm, jwks);
	}

	/**
	 * The claims a subclass exposes, as a plain object.
	 *
	 * Reads the getters declared directly on the instance's own prototype, so what
	 * comes out is the subclass's view of the token — the claims it models — and not
	 * the registered-claim accessors it inherited but may not use.
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
	 * The `kid` of the chosen key goes into the header, so a relying party can tell
	 * which published key to verify against even though this package's own JWKS
	 * resolution does not use it yet.
	 *
	 * @param jwt - The token to sign.
	 * @param algorithm - Algorithm to sign with; also selects the key.
	 * @param jwks - Candidate keys, newest first.
	 * @returns The compact-serialized token.
	 * @throws When no key in the set was generated for that algorithm.
	 */
	static sign(jwt: JWT, algorithm: JWK.Algoritm, jwks: JWK.SigningKey[]): Promise<string> {
		let key = jwks.find((candidate) => candidate.alg === algorithm);
		if (!key) throw new Error(`No key available to sign JWT with algorithm ${algorithm}`);

		return new jose.SignJWT(jwt.payload)
			.setProtectedHeader({ alg: algorithm, typ: "JWT", kid: key.id })
			.sign(key.private);
	}

	/**
	 * Verifies a token and returns it as an instance of the class this was called on.
	 *
	 * Signature, `exp`, `nbf`, and whichever of `issuer` and `audience` are given are
	 * all checked by jose, which throws on the first failure — so reaching the return
	 * value means the claims are trustworthy. Calling this on a subclass produces that
	 * subclass, which is what makes `IdToken.verify(...)` yield typed claim accessors.
	 *
	 * @param token - The compact-serialized token.
	 * @param jwks - Candidate verification keys.
	 * @param options - Expected issuer, audience, clock tolerance, and so on.
	 * @returns The verified token.
	 * @throws When no key is available, or when jose rejects the token.
	 * @example
	 * let idToken = await IdToken.verify(raw, keys, { issuer, audience: clientId });
	 */
	static async verify<M extends JWT>(
		this: new (payload: JWT.Payload) => M,
		token: string,
		jwks: JWK.VerificationKey[],
		options?: JWT.VerifyOptions,
	): Promise<M> {
		let key = jwks.find((candidate) => candidate.public);
		if (!key) throw new Error("No key available to verify JWT");

		let result = await jose.jwtVerify(token, key.public, options);

		return new this(result.payload);
	}

	/**
	 * Reads a token's claims without checking anything.
	 *
	 * Nothing that comes back has been authenticated. Use it to look at a token before
	 * deciding how to verify it — reading `iss` to pick a JWKS, for instance — never to
	 * make a decision about the request.
	 *
	 * @param token - The compact-serialized token.
	 * @returns The decoded token, as an instance of the class this was called on.
	 */
	static decode<M extends JWT>(this: new (payload: JWT.Payload) => M, token: string): M {
		return new this(jose.decodeJwt(token));
	}
}

export namespace JWT {
	/** A JWT claim set. */
	export type Payload = jose.JWTPayload;

	/** The checks `JWT.verify` can be asked to run beyond the signature. */
	export type VerifyOptions = jose.JWTVerifyOptions;
}
