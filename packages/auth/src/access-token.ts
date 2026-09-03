/**
 * The access token a grant produces, with the two claims a resource server reads
 * as accessors: the granted scopes and the client that was granted them. Its `has`
 * is the question a route asks before it acts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@sdxc/jwt";

/**
 * A JWT access token, per RFC 9068. `audience` reads either shape of `aud`: the client
 * id on an authorization-code token, and the issuer plus every requested resource on
 * a client-credentials one.
 *
 * @example
 * let token = await AccessToken.verify(raw, await issuer.keys(), { issuer, audience });
 * if (!token.has("monitors:write")) return null;
 */
export class AccessToken extends JWT {
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
}
