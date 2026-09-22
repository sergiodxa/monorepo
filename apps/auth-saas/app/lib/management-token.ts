/**
 * The management API's own access token claims, shared by the token endpoint that
 * mints one and the auth-resolution middleware that verifies one, so the two agree
 * on exactly one shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@sdxc/jwt";

/** How long a management access token signs for — short, since the caller holds the credential that mints another. */
export const MANAGEMENT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

/** A management access token's claims: no subject session, no scope beyond the client's own bound tenant. */
export class ManagementAccessToken extends JWT {
	override get subject(): string {
		return this.parser.string("sub");
	}

	/** The management client this token was minted for. */
	get clientId(): string {
		return this.parser.string("client_id");
	}

	/** The tenant this token is scoped to — every route behind it reads its data no wider than this. */
	get tenantId(): string {
		return this.parser.string("tenant_id");
	}

	/** The granted scopes, space-joined exactly as the token carries them. */
	get scope(): string {
		return this.parser.string("scope");
	}
}
