/**
 * Value Object for OAuth 2.0 Access Tokens (JWT profile, RFC 9068).
 *
 * Wraps a signed JWT with typed accessors for the standard authorization claims
 * and a factory for minting new one-hour tokens for a subject and audience.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@edgefirst-dev/jwt";

/** Access token time-to-live in milliseconds (1 hour). */
const ACCESS_TOKEN_TTL = 60 * 60 * 1000;

/**
 * Value Object for OAuth 2.0 Access Tokens.
 * Extends JWT with standard claims for authorization.
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
	 * Generates a new access token with the given parameters.
	 * @param issuer - Token issuer URL
	 * @param audience - Intended audience (single or multiple)
	 * @param subjectId - Subject identifier
	 * @param scope - Optional array of scope strings
	 * @returns New AccessToken instance
	 * @example
	 * let token = AccessToken.generate(issuer, resource.identifier, subject.id, ["read"]);
	 */
	static generate(
		issuer: string,
		audience: string | string[],
		subjectId: string,
		scope?: string[],
	) {
		let now = Math.floor(Date.now() / 1000);
		let expiresAt = now + Math.floor(ACCESS_TOKEN_TTL / 1000);

		return new AccessToken({
			aud: audience,
			exp: expiresAt,
			iat: now,
			iss: issuer,
			jti: crypto.randomUUID(),
			nbf: now,
			sub: subjectId,
			...(scope && { scope: scope.join(" ") }),
		});
	}

	/**
	 * Default token TTL in seconds.
	 */
	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
