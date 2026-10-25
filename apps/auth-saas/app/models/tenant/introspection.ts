/**
 * Token introspection (RFC 7662) for the tokens this tenant issues, answered as JSON or,
 * when the caller asks, as a signed JWT (RFC 9701) so a resource server can rely on the
 * answer without trusting the connection it travelled over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Hex, sha256 } from "@sdxc/crypto";
import { JWK, JWT } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";

import { currentSigningKeyPair, publishKeySet } from "~/app/models/tenant/signing-keys";
import { subjects } from "~/app/models/tenant/subjects";
import { AccessToken, authenticateClient, refreshTokenRows } from "~/app/models/tenant/tokens";

/** The media type RFC 9701 §4 registers for a signed introspection response. */
export const INTROSPECTION_JWT_MEDIA_TYPE = "application/token-introspection+jwt";

/** The algorithm a signed introspection response is signed with. */
export const INTROSPECTION_SIGNING_ALGORITHMS = [JWK.Algorithm.ES256];

/** Milliseconds in a second, the factor between the clock and a token's epoch claims. */
const MS_PER_SECOND = 1000;

/** A signed introspection response, typed so it never verifies as another kind of JWT. */
export class IntrospectionResponse extends JWT {
	static override type = "token-introspection+jwt";
}

/** What RFC 7662 §2.2 answers about a token; `active: false` alone for any token not honored. */
export type TokenDescription = { active: false } | ({ active: true } & Record<string, unknown>);

export interface IntrospectTokenInput {
	token: string;
	tokenTypeHint: string | null;
	clientId: string;
	clientSecret: string | null;
	authScheme: "basic" | "post";
	/** Whether to answer with an RFC 9701 signed response. */
	signed: boolean;
	now: number;
	/** The tenant's own issuer, which access tokens are held to and a signed answer names. */
	issuer: string;
}

let IntrospectTokenSchema = s.object({
	token: s.string(),
	tokenTypeHint: s.nullable(s.string()),
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: s.enum_(["basic", "post"] as const),
	signed: s.boolean(),
	now: s.number(),
	issuer: s.string(),
});

export type IntrospectTokenResult =
	| { kind: "json"; description: TokenDescription }
	| { kind: "jwt"; jwt: string }
	| { kind: "error"; status: 400 | 401 | 500; error: string; description: string };

/** A token this tenant does not stand behind. */
const INACTIVE: TokenDescription = { active: false };

/**
 * Describes an access token this tenant signed: active while its signature holds, it has
 * not expired, and its subject is not blocked.
 */
async function describeAccessToken(
	db: Database,
	token: string,
	input: { issuer: string; now: number },
): Promise<TokenDescription | null> {
	let keys = await JWK.importLocal(await publishKeySet(db, { now: input.now }));

	let verified: AccessToken;
	try {
		verified = await AccessToken.verify(token, keys, {
			issuer: input.issuer,
			algorithms: [JWK.Algorithm.ES256],
			currentDate: new Date(input.now),
		});
	} catch {
		return null;
	}

	let subject = await db.find(subjects, { id: verified.subject });
	if (subject?.status === "blocked") return INACTIVE;

	let claims = verified.payload;
	let cnf = claims.cnf as { jkt?: string } | undefined;

	return {
		active: true,
		scope: claims.scope,
		client_id: claims.client_id,
		sub: claims.sub,
		aud: claims.aud,
		iss: claims.iss,
		exp: claims.exp,
		iat: claims.iat,
		jti: claims.jti,
		token_type: cnf?.jkt ? "DPoP" : "Bearer",
		...(claims.acr ? { acr: claims.acr } : {}),
		...(claims.auth_time ? { auth_time: claims.auth_time } : {}),
		...(claims.act ? { act: claims.act } : {}),
		...(cnf?.jkt ? { cnf: { jkt: cnf.jkt } } : {}),
	};
}

/**
 * Describes a refresh token to the client it was issued to; to any other client it is
 * inactive, so one client cannot probe another's refresh tokens.
 */
async function describeRefreshToken(
	db: Database,
	token: string,
	input: { clientId: string; now: number },
): Promise<TokenDescription | null> {
	let hashed = await sha256(token);
	if (isFailure(hashed)) return null;

	let row = await db.find(refreshTokenRows, { token_hash: Hex.encode(hashed.data) });
	if (row === null) return null;

	let live =
		row.redeemed_at === null &&
		row.revoked_at === null &&
		row.expires_at > input.now &&
		row.absolute_expires_at > input.now;
	if (!live || row.client_id !== input.clientId) return INACTIVE;

	return {
		active: true,
		scope: (row.scopes as string[]).join(" "),
		client_id: row.client_id,
		sub: row.subject_id,
		exp: Math.floor(Math.min(row.expires_at, row.absolute_expires_at) / MS_PER_SECOND),
		iat: Math.floor(row.created_at / MS_PER_SECOND),
		token_type: "refresh_token",
		...(row.jkt ? { cnf: { jkt: row.jkt } } : {}),
	};
}

/**
 * Describes a token to an authenticated confidential client (RFC 7662), reading it as an
 * access token or a refresh token in the order `token_type_hint` suggests. The signed
 * form (RFC 9701 §5) names the tenant as `iss` and the calling client as `aud`.
 *
 * @param db - The tenant's database.
 * @param input - The token, the hint, the caller's credentials and the answer's form.
 * @returns The description as JSON or as a signed JWT, or the caller's own failure.
 */
export async function introspectToken(
	db: Database,
	input: IntrospectTokenInput,
): Promise<IntrospectTokenResult> {
	let parsed = s.parse(IntrospectTokenSchema, input);

	let authenticated = await authenticateClient(db, parsed);
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}

	let readers = [
		() => describeAccessToken(db, parsed.token, parsed),
		() => describeRefreshToken(db, parsed.token, parsed),
	];
	if (parsed.tokenTypeHint === "refresh_token") readers.reverse();

	let description = INACTIVE;
	for (let read of readers) {
		let found = await read();
		if (found !== null) {
			description = found;
			break;
		}
	}

	if (!parsed.signed) return { kind: "json", description };

	let keyPair = await currentSigningKeyPair(db);
	if (!keyPair) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "No signing key is available for this tenant.",
		};
	}

	let jwt = await new IntrospectionResponse({
		iss: parsed.issuer,
		aud: parsed.clientId,
		iat: Math.floor(parsed.now / MS_PER_SECOND),
		jti: generateUUID(),
		token_introspection: description,
	}).sign(JWK.Algorithm.ES256, [keyPair]);

	return { kind: "jwt", jwt };
}
