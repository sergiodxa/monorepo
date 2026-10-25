/**
 * The access token a grant produces, with the two claims a resource server reads
 * as accessors: the granted scopes and the client that was granted them. Its `has`
 * is the question a route asks before it acts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationString } from "@sdxc/duration";

import { toSeconds } from "@sdxc/duration";
import { JWT } from "@sdxc/jwt";

/** Milliseconds in a second, the factor between `auth_time` and a `Date`. */
const MS_PER_SECOND = 1000;

/**
 * A JWT access token, per RFC 9068. `audience` reads either shape of `aud`: the client
 * id on an authorization-code token, and the issuer plus every requested resource on
 * a client-credentials one.
 *
 * OAuth2 states no shape for an access token at all — RFC 9068 is this platform's own
 * choice, not a rule every issuer follows, so a third-party provider's access token is
 * commonly an opaque string a resource server alone can dereference. `decode` and
 * `verify` stay strict, since a call naming either already knows it holds a JWT;
 * `tryDecode` is for a caller that does not, such as a relying party reading whatever a
 * token endpoint answered with.
 *
 * @example
 * let token = await AccessToken.verify(raw, await issuer.keys(), { issuer, audience });
 * if (!token.has("monitors:write")) return null;
 */
export class AccessToken extends JWT {
	/**
	 * Reads an access token's claims the way {@link JWT.decode} does, answering `null`
	 * instead of throwing for a string that is not a compact JWT at all — the shape a
	 * third-party provider's opaque access token takes.
	 *
	 * @param token - The access token exactly as the token endpoint answered it.
	 * @returns The decoded token, or `null` for one this class cannot read as a JWT.
	 * @example
	 * let accessToken = AccessToken.tryDecode(response.access_token);
	 * if (accessToken?.has("email")) …
	 */
	static tryDecode(token: string): AccessToken | null {
		try {
			return AccessToken.decode(token);
		} catch {
			return null;
		}
	}

	/**
	 * The granted scopes as a list, split from the one space-separated string `scope`
	 * arrives as, so every scope check compares whole values from the same reading.
	 */
	get scopes(): string[] {
		if (!this.parser.has("scope")) return [];
		return this.parser
			.string("scope")
			.split(" ")
			.filter((scope) => scope.length > 0);
	}

	/**
	 * The `client_id` RFC 9068 §2.2 requires, naming the caller even where `sub`
	 * identifies the person the caller acts for.
	 */
	get clientId(): string | null {
		if (this.parser.has("client_id")) return this.parser.string("client_id");
		return null;
	}

	/**
	 * Whether the token was issued to a client acting as itself, which RFC 9068 §2.2.1
	 * marks with a `sub` equal to `client_id`.
	 *
	 * @returns `true` when both claims are present and carry the same value; a token
	 *   carrying one of them alone, or neither, is read as a person's.
	 */
	get issuedToService(): boolean {
		if (!this.parser.has("sub")) return false;
		if (!this.parser.has("client_id")) return false;
		return this.parser.string("sub") === this.parser.string("client_id");
	}

	/**
	 * Whether one scope was granted, comparing whole scope values, so `monitors:read`
	 * is matched by `monitors:read` alone.
	 *
	 * @param scope - The scope name a route requires.
	 */
	has(scope: string): boolean {
		return this.scopes.includes(scope);
	}

	/**
	 * The thumbprint of the key the token is bound to, from `cnf.jkt` (RFC 9449 §6.1); a
	 * bound token is honored only beside a proof signed with that key.
	 */
	get jkt(): string | null {
		let confirmation = this.parser.has("cnf") ? this.parser.get("cnf") : null;
		if (typeof confirmation !== "object" || confirmation === null) return null;
		let jkt = (confirmation as Record<string, unknown>).jkt;
		return typeof jkt === "string" ? jkt : null;
	}

	/** The authentication context class the user was signed in at (RFC 9068 §2.2.1). */
	get acr(): string | null {
		if (this.parser.has("acr")) return this.parser.string("acr");
		return null;
	}

	/** When the user last actively authenticated (RFC 9068 §2.2.1). */
	get authTime(): Date | null {
		if (!this.parser.has("auth_time")) return null;
		return new Date(this.parser.number("auth_time") * MS_PER_SECOND);
	}

	/**
	 * Whether the user's authentication behind this token meets a route's requirement,
	 * the check RFC 9470 §3 answers `insufficient_user_authentication` for. A token missing
	 * the claim a requirement reads fails that requirement.
	 *
	 * @param requirement - The classes accepted and how old the authentication may be.
	 * @param now - The instant `maxAge` is measured back from.
	 * @example
	 * if (!token.meets({ acrValues: ["mfa"], maxAge: "15 minutes" })) return stepUp();
	 */
	meets(requirement: AccessToken.AuthenticationRequirement, now: Date = new Date()): boolean {
		let { acrValues = [], maxAge } = requirement;

		if (acrValues.length > 0) {
			let acr = this.acr;
			if (acr === null || !acrValues.includes(acr)) return false;
		}

		if (maxAge === undefined) return true;

		let authTime = this.authTime;
		if (authTime === null) return false;
		let seconds = typeof maxAge === "string" ? toSeconds(maxAge) : maxAge;
		return now.getTime() - authTime.getTime() <= seconds * MS_PER_SECOND;
	}
}

export namespace AccessToken {
	/** The user authentication a route requires before it acts, per RFC 9470 §3. */
	export interface AuthenticationRequirement {
		/** The `acr` values accepted, in order of preference; empty accepts any. */
		acrValues?: string[];
		/**
		 * How long ago the user may have authenticated, in seconds or as a duration
		 * string; absent accepts any age.
		 */
		maxAge?: number | DurationString;
	}
}
