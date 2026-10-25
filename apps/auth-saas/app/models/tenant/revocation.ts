/**
 * Token revocation (RFC 7009) for the refresh tokens this tenant issues: a client
 * surrenders a refresh token and its whole rotation family stops working, so signing out
 * of an app ends its long-lived grant at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Hex, sha256 } from "@sdxc/crypto";
import { JWK } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { AuthScheme } from "~/app/models/tenant/tokens";

import { publishKeySet } from "~/app/models/tenant/signing-keys";
import {
	AccessToken,
	AuthSchemeSchema,
	authenticateClient,
	refreshTokenRows,
	revokeFamily,
} from "~/app/models/tenant/tokens";

export interface RevokeTokenInput {
	token: string;
	tokenTypeHint: string | null;
	clientId: string;
	clientSecret: string | null;
	authScheme: AuthScheme;
	now: number;
	/** The tenant's own issuer, which an access token presented here is held to. */
	issuer: string;
}

let RevokeTokenSchema = s.object({
	token: s.string(),
	tokenTypeHint: s.nullable(s.string()),
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: AuthSchemeSchema,
	now: s.number(),
	issuer: s.string(),
});

export type RevokeTokenResult =
	| { kind: "revoked" }
	| { kind: "error"; status: 400 | 401; error: string; description: string };

/**
 * Whether a token is an access token this tenant signed and still honors, which a
 * revocation cannot withdraw: access tokens are self-contained and simply run out.
 */
async function isLiveAccessToken(
	db: Database,
	token: string,
	input: { issuer: string; now: number },
): Promise<boolean> {
	try {
		let keys = await JWK.importLocal(await publishKeySet(db, { now: input.now }));
		await AccessToken.verify(token, keys, {
			issuer: input.issuer,
			algorithms: [JWK.Algorithm.ES256],
			currentDate: new Date(input.now),
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Revokes a refresh token the calling client holds, and every token rotated from the same
 * grant. An unknown or already-revoked token, and one issued to another client, answer
 * as revoked too (RFC 7009 §2.2), so the endpoint confirms nothing about tokens a caller
 * does not own; a live access token is `unsupported_token_type`, since it cannot be withdrawn.
 *
 * @param db - The tenant's database.
 * @param input - The token, its type hint, and the caller's credentials.
 * @returns That the token no longer works, or why the request was refused.
 */
export async function revokeToken(
	db: Database,
	input: RevokeTokenInput,
): Promise<RevokeTokenResult> {
	let parsed = s.parse(RevokeTokenSchema, input);

	let authenticated = await authenticateClient(db, parsed);
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}

	let hashed = await sha256(parsed.token);
	if (isFailure(hashed)) return { kind: "revoked" };

	let row = await db.find(refreshTokenRows, { token_hash: Hex.encode(hashed.data) });
	if (row !== null) {
		if (row.client_id === authenticated.client.id)
			await revokeFamily(db, row.family_id, parsed.now);
		return { kind: "revoked" };
	}

	if (await isLiveAccessToken(db, parsed.token, parsed)) {
		return {
			kind: "error",
			status: 400,
			error: "unsupported_token_type",
			description:
				"Access tokens expire on their own and cannot be revoked; revoke the refresh token.",
		};
	}

	return { kind: "revoked" };
}
