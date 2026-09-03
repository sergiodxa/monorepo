/**
 * The OAuth 2.0 access token this server issues: a JWT with typed accessors for the
 * claims RFC 9068 defines, plus the generator that mints one for an audience, a
 * subject and a client. A value object, so every endpoint reads and writes the
 * bearer token through one description of its claim set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@sdxc/jwt";

import { ACCESS_TOKEN_TTL, ISSUER } from "~/app/config";

/** An access token, read from or minted for the OAuth 2.0 endpoints. */
export default class AccessToken extends JWT {
	/** Unique token id (`jti`), which makes a token individually identifiable. */
	override get id() {
		return this.parser.string("jti");
	}

	/** Expiry as the raw `exp` claim, in seconds since the epoch. */
	override get expiresIn() {
		return this.parser.number("exp");
	}

	/** Narrowed to always present, so callers read the seconds without a null check. */
	override get expirationTime() {
		return this.parser.number("exp");
	}

	/** When the token was issued, converted from the seconds RFC 7519 stores. */
	override get issuedAt() {
		return new Date(this.parser.number("iat") * 1000);
	}

	/** The authorization server that signed the token (`iss`). */
	override get issuer() {
		return this.parser.string("iss");
	}

	/** The person the token speaks for (`sub`). */
	override get subject() {
		return this.parser.string("sub");
	}

	/**
	 * Granted scopes, empty when the token carries no `scope` claim: RFC 9068 writes
	 * `scope` only when scopes were granted, so a `client_credentials` or scope-less
	 * refresh token yields an empty list and the caller decides its entitlements.
	 */
	get scopes(): string[] {
		if (!this.parser.has("scope")) return [];
		return this.parser.string("scope").split(" ");
	}

	/**
	 * The client the token was issued to (`client_id`), which RFC 9068 §2.2 requires.
	 * Absent yields `null` rather than throwing, so a token minted before the claim
	 * existed stays readable for the rest of its lifetime.
	 */
	get clientId(): string | null {
		if (!this.parser.has("client_id")) return null;
		return this.parser.string("client_id");
	}

	/**
	 * Mints an access token valid for {@link ACCESS_TOKEN_TTL}. Timestamps are seconds
	 * since the epoch, the NumericDate form RFC 7519 defines, and `scope` is written
	 * only when scopes were granted, as RFC 9068 requires.
	 *
	 * Claims are named rather than positional, so the audience, the subject and the
	 * client cannot be transposed at a call site and the required client is stated
	 * by the type.
	 *
	 * @param claims.audience - Client id, or the client plus every requested resource.
	 * @param claims.subjectId - The person the token speaks for, or the client itself
	 *   for `client_credentials`, where RFC 9068 §2.2.1 has `sub` name the client.
	 * @param claims.clientId - The client that asked for the token.
	 * @param claims.scope - Granted scopes, joined into the space-separated claim.
	 */
	static generate(claims: {
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
			iss: ISSUER,
			jti: crypto.randomUUID(),
			sub: claims.subjectId,
			...(claims.scope && { scope: claims.scope.join(" ") }),
		});
	}

	/** Token lifetime in seconds, which is the unit `expires_in` is reported in. */
	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
