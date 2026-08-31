/**
 * Value Object for OAuth 2.0 Access Tokens (JWT profile, RFC 9068).
 *
 * Wraps a signed JWT with typed accessors for the standard authorization claims
 * and a factory for minting new one-hour tokens for a subject and audience.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@pkg/jwt";

/** Access token time-to-live in milliseconds (1 hour). */
const ACCESS_TOKEN_TTL = 60 * 60 * 1000;

/**
 * Value Object for OAuth 2.0 access tokens.
 * Covers the RFC 9068 claim set: sub, aud, client_id, exp, iat, nbf, jti, and scope.
 */
export default class AccessToken extends JWT {
	/**
	 * Unique identifier for this token (jti claim).
	 */
	override get id() {
		return this.parser.string("jti");
	}

	/**
	 * Intended audience for this token (aud claim).
	 * Can be a single string or array of audience identifiers.
	 */
	override get audience(): string | string[] | null {
		let aud = this.payload.aud;
		if (Array.isArray(aud)) return aud;
		if (typeof aud === "string") return aud;
		return null;
	}

	/**
	 * Token expiration time as Unix timestamp (exp claim).
	 */
	override get expiresIn() {
		return this.parser.number("exp");
	}

	/**
	 * Token issued-at time as Date (iat claim).
	 */
	override get issuedAt() {
		return new Date(this.parser.number("iat") * 1000);
	}

	/**
	 * Token issuer URL (iss claim).
	 */
	override get issuer() {
		return this.parser.string("iss");
	}

	/**
	 * Token not-before time as Date (nbf claim).
	 */
	override get notBefore() {
		return new Date(this.parser.number("nbf") * 1000);
	}

	/**
	 * Subject identifier (sub claim).
	 */
	override get subject() {
		return this.parser.string("sub");
	}

	/**
	 * Space-separated scope string (scope claim).
	 */
	get scope() {
		return this.parser.string("scope");
	}

	/**
	 * Client the token was issued to (client_id claim).
	 */
	get clientId() {
		return this.parser.string("client_id");
	}

	/**
	 * Generates a new access token with the given claims. Named claims keep the
	 * issuer, audience, subject, and client from being transposed at a call site.
	 * @param claims - Issuer URL, audience, subject identifier, client identifier,
	 * and an optional array of scope strings
	 * @returns New AccessToken instance
	 * @example
	 * let token = AccessToken.generate({
	 * 	issuer,
	 * 	audience: resource.identifier,
	 * 	subjectId: subject.id,
	 * 	clientId: client.id,
	 * 	scope: ["read"],
	 * });
	 */
	static generate(claims: {
		issuer: string;
		audience: string | string[];
		subjectId: string;
		clientId: string;
		scope?: string[];
	}) {
		let now = Math.floor(Date.now() / 1000);
		let expiresAt = now + Math.floor(ACCESS_TOKEN_TTL / 1000);

		return new AccessToken({
			aud: claims.audience,
			client_id: claims.clientId,
			exp: expiresAt,
			iat: now,
			iss: claims.issuer,
			jti: crypto.randomUUID(),
			nbf: now,
			sub: claims.subjectId,
			...(claims.scope && { scope: claims.scope.join(" ") }),
		});
	}

	/**
	 * Default token TTL in seconds.
	 */
	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
