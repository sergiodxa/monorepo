/**
 * The OAuth 2.0 access token this server issues: a JWT with typed accessors for the
 * claims RFC 9068 defines, plus the generator that mints one for an audience and
 * subject. Modelled as a value object so every endpoint reads and writes the bearer
 * token through one description of its claim set rather than raw JWT payloads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@pkg/jwt";

import { ACCESS_TOKEN_TTL, ISSUER } from "~/app/config";

/** An access token, read from or minted for the OAuth 2.0 endpoints. */
export default class AccessToken extends JWT {
	/** Unique token id (`jti`), which makes a token individually identifiable. */
	override get id() {
		return this.parser.string("jti");
	}

	/** Who the token was issued for (`aud`): the client, or a requested resource. */
	override get audience() {
		return this.parser.string("aud");
	}

	/** Expiry as the raw `exp` claim, in seconds since the epoch. */
	override get expiresIn() {
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
	 * Granted scopes as an array, empty when the token carries no `scope` claim.
	 *
	 * RFC 9068 writes `scope` only when scopes were granted and omits it otherwise, so this
	 * reads through a presence check rather than the parser's throwing accessor: a
	 * scope-less token — a `client_credentials` token, or a refresh token minted without
	 * scope — yields an empty list instead of raising, leaving the caller to decide whether
	 * that token is entitled to what it is asking for.
	 */
	get scopes(): string[] {
		if (!this.parser.has("scope")) return [];
		return this.parser.string("scope").split(" ");
	}

	/**
	 * Mints an access token valid for {@link ACCESS_TOKEN_TTL}. The `scope` claim is
	 * written only when scopes were granted, since RFC 9068 leaves it out otherwise.
	 *
	 * @param audience - Client id, or the client plus every requested resource.
	 * @param subjectId - The person the token speaks for.
	 * @param scope - Granted scopes, joined into the space-separated claim.
	 */
	static generate(audience: string | string[], subjectId: string, scope?: string[]) {
		let now = Math.floor(Date.now() / 1000); // RFC 7519 NumericDate is in seconds
		let expiresAt = now + Math.floor(ACCESS_TOKEN_TTL / 1000);

		return new AccessToken({
			aud: audience,
			exp: expiresAt,
			iat: now,
			iss: ISSUER,
			jti: crypto.randomUUID(),
			sub: subjectId,
			...(scope && { scope: scope.join(" ") }),
		});
	}

	/** Token lifetime in seconds, which is the unit `expires_in` is reported in. */
	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
