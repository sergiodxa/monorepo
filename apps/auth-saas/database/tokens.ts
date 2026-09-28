/**
 * The token endpoint's whole operation: the `refresh_tokens` table, and
 * `exchangeCode`/`refreshTokens`, which authenticate the calling client, redeem an
 * authorization code or a refresh token, mint and sign an access token and (when
 * the grant covers `openid`) an ID token, and rotate a refresh token when the
 * grant covers `offline_access`. A token is the one bearer value allowed to cross
 * the object's boundary, because producing it is the operation; the signing key
 * itself never leaves.
 *
 * Rotation makes a stolen refresh token detectable rather than merely
 * short-lived: presenting one a second time revokes every token in its family and
 * ends the session behind it, and answers exactly like an expired token would, so
 * neither an attacker nor a client racing itself learns which case it hit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Base64Url, Hex, randomToken, sha256 } from "@sdxc/crypto";
import { JWK, JWT } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { and, column as c, eq, gt, inList, isNull, lt, table } from "remix/data-table";

import type { ClientRow } from "./clients";
import type { SubjectRow } from "./subjects";

import { authorizationCodes } from "./authorization";
import { isClientIdUrl } from "./client-id-metadata";
import { clients, verifyClientSecret } from "./clients";
import { scopes } from "./consent";
import { resolveRoleAndPermissionClaims } from "./roles";
import { revokeSession, sessions } from "./sessions";
import { currentSigningKeyPair, customClaims, ensureSigningKey } from "./signing-keys";
import { subjectAttributes, subjectIdentifiers, subjects } from "./subjects";

/** How long an access token signs for before a resource server must ask again. */
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * How long an ID token signs for. Shorter than an access token because it is
 * consumed at the exchange and only ever read again as an `id_token_hint`.
 */
const ID_TOKEN_TTL_MS = 10 * 60 * 1000;

/** How long a rotated refresh token's own idle clock lasts, renewed on every rotation. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** How long a refresh token family lives from its first token, unmoved by any later rotation. */
export const REFRESH_TOKEN_FAMILY_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** How many expired rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** Mints an id for a new refresh token family. */
export const refreshTokenFamilyId = typeid("rtfam");

/** Mints the `jti` an access token carries, for the audit log to key a replay report by. */
const accessTokenId = typeid("at");

/** A rotated refresh token: single-use, chained by `parent_hash`, grouped by `family_id`. */
export const refreshTokenRows = table({
	name: "refresh_tokens",
	primaryKey: ["token_hash"],
	columns: {
		token_hash: c.text(),
		family_id: c.text(),
		parent_hash: c.text().nullable(),
		client_id: c.text(),
		subject_id: c.text(),
		session_id: c.text(),
		scopes: c.json(),
		created_at: c.integer(),
		expires_at: c.integer(),
		absolute_expires_at: c.integer(),
		redeemed_at: c.integer().nullable(),
		revoked_at: c.integer().nullable(),
	},
});

export type RefreshTokenRow = TableRow<typeof refreshTokenRows>;

/**
 * An ID token's claims, following the base class's own subclassing pattern:
 * registered claims a token of this kind always carries are narrowed to their
 * non-null type, and the claims beyond the registered set get accessors of
 * their own.
 */
export class IdToken extends JWT {
	override get subject(): string {
		return this.parser.string("sub");
	}

	override get audience(): string {
		return this.parser.string("aud");
	}

	/** The session's last full authentication, as a `Date`. */
	get authTime(): Date {
		return new Date(this.parser.number("auth_time") * 1000);
	}

	/** The authorization request's `nonce`, echoed back, or `null` when none was given. */
	get nonce(): string | null {
		return this.parser.has("nonce") ? this.parser.string("nonce") : null;
	}

	/** The authentication methods the session records. */
	get amr(): string[] {
		return this.parser.has("amr") ? (this.parser.get("amr") as string[]) : [];
	}

	/** The session record id — not the session's own bearer cookie value. */
	get sessionId(): string {
		return this.parser.string("sid");
	}
}

/** An access token's claims, following the same subclassing pattern as {@link IdToken}. */
export class AccessToken extends JWT {
	override get subject(): string {
		return this.parser.string("sub");
	}

	/** The client this token was minted for. */
	get clientId(): string {
		return this.parser.string("client_id");
	}

	/** The granted scopes, space-joined exactly as the token carries them. */
	get scope(): string {
		return this.parser.string("scope");
	}

	/** The session record id this token was minted from. */
	get sessionId(): string {
		return this.parser.string("sid");
	}
}

/**
 * What `exchangeCode` and `refreshTokens` both answer with: a minted set on
 * success, or an error. `status` extends the ADR's `400 | 401` with `500` for the
 * one case that is not a client's fault — no signing key exists for this tenant —
 * since a token endpoint has nowhere else to put a server malfunction.
 */
export type TokenOutcome =
	| {
			kind: "tokens";
			accessToken: string;
			idToken: string | null;
			refreshToken: string | null;
			tokenType: "Bearer";
			expiresIn: number;
			scope: string;
	  }
	| { kind: "error"; status: 400 | 401 | 500; error: string; description: string };

/** How a client presented itself at this call, mirroring the OAuth 2.1 methods this endpoint accepts. */
export type AuthScheme = "basic" | "post" | "none";

export let AuthSchemeSchema = s.enum_(["basic", "post", "none"] as const);

export interface AuthenticateClientInput {
	clientId: string;
	clientSecret: string | null;
	authScheme: AuthScheme;
}

export type AuthenticateClientResult =
	| { ok: true; client: ClientRow }
	| { ok: false; status: 400 | 401; description: string };

/**
 * The row a client identified by a Client ID Metadata Document authenticates as: a
 * public client with no secret, minting under the algorithm every client defaults to.
 * Nothing here is read from storage, since the URL naming this client is never written
 * to the tenant's own client table; the authorization code this client redeems already
 * bound its granted scopes and redirect target at the authorize step, so this row only
 * has to carry what minting a token still reads off it.
 */
function cimdClientRow(clientId: string): ClientRow {
	let now = Date.now();

	return {
		id: clientId,
		name: clientId,
		kind: "public",
		redirect_uris: [],
		post_logout_redirect_uris: [],
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scopes: [],
		token_endpoint_auth_method: "none",
		require_consent: true,
		created_at: now,
		updated_at: now,
		disabled_at: null,
		include_permissions: false,
		id_token_signed_response_alg: "ES256",
	} as ClientRow;
}

/**
 * Resolves and authenticates the client presenting one credential shape: `none`
 * is valid only for a public client, whose proof is PKCE rather than a secret;
 * `basic`/`post` is valid only for a confidential client whose own registered
 * method matches the scheme presented exactly. A failure from a client that
 * authenticated through the `Authorization` header answers at 401, the one case
 * OAuth 2.1 asks for a `WWW-Authenticate` challenge rather than a plain 400 — the
 * caller already holds the `basic` scheme it used to reach here, so no header
 * value needs to cross back for it to build one.
 *
 * A `client_id` shaped as an `https://` URL identifies a Client ID Metadata Document
 * rather than a row in this tenant's own client table; such a client is always public,
 * so it authenticates only with `none`, exactly as a public row would.
 *
 * Exported so a caller that only needs to know whether a client is who it
 * claims — minting nothing — reaches the same check `exchangeCode` and
 * `refreshTokens` already authenticate through.
 */
export async function authenticateClient(
	db: Database,
	input: AuthenticateClientInput,
): Promise<AuthenticateClientResult> {
	let failureStatus: 400 | 401 = input.authScheme === "basic" ? 401 : 400;

	if (isClientIdUrl(input.clientId)) {
		if (input.authScheme !== "none") {
			return {
				ok: false,
				status: failureStatus,
				description:
					"This application is identified by a URL and holds no secret to authenticate with.",
			};
		}

		return { ok: true, client: cimdClientRow(input.clientId) };
	}

	let client = await db.find(clients, { id: input.clientId });
	if (!client) {
		return { ok: false, status: failureStatus, description: "This application is not registered." };
	}

	if (input.authScheme === "none") {
		if (client.kind !== "public") {
			return {
				ok: false,
				status: failureStatus,
				description: "This application must authenticate with its registered credentials.",
			};
		}

		return { ok: true, client };
	}

	if (client.kind !== "confidential") {
		return {
			ok: false,
			status: failureStatus,
			description: "This application holds no secret to authenticate with.",
		};
	}

	let expectedMethod = input.authScheme === "basic" ? "client_secret_basic" : "client_secret_post";
	if (client.token_endpoint_auth_method !== expectedMethod) {
		return {
			ok: false,
			status: failureStatus,
			description: "This application must authenticate with its registered method.",
		};
	}

	if (!input.clientSecret) {
		return { ok: false, status: failureStatus, description: "A client secret is required." };
	}

	let verified = await verifyClientSecret(db, {
		clientId: input.clientId,
		secret: input.clientSecret,
	});
	if (!verified.ok) {
		return { ok: false, status: failureStatus, description: "The client secret did not verify." };
	}

	return { ok: true, client };
}

/** Standard claim names read straight off a subject's profile columns. */
const PROFILE_CLAIM_COLUMNS: Record<string, keyof SubjectRow> = {
	name: "name",
	given_name: "given_name",
	family_name: "family_name",
	nickname: "nickname",
	preferred_username: "preferred_username",
	picture: "picture",
	locale: "locale",
	zoneinfo: "zoneinfo",
};

/** Adds the profile and email claims the granted scopes carry, each only when the subject holds a value. */
async function addStandardProfileClaims(
	db: Database,
	idClaims: Record<string, unknown>,
	subjectId: string,
	grantedScopes: string[],
): Promise<void> {
	if (grantedScopes.length === 0) return;

	let scopeRows = await db.findMany(scopes, { where: inList("name", grantedScopes) });
	let claimNames = new Set<string>();
	for (let row of scopeRows) for (let name of row.claims as string[]) claimNames.add(name);
	if (claimNames.size === 0) return;

	let subject = await db.find(subjects, { id: subjectId });
	if (!subject) return;

	for (let [claim, column] of Object.entries(PROFILE_CLAIM_COLUMNS)) {
		if (!claimNames.has(claim)) continue;
		let value = subject[column];
		if (value !== null && value !== undefined) idClaims[claim] = value;
	}

	if (claimNames.has("email") || claimNames.has("email_verified")) {
		let primaryEmail = await db.findOne(subjectIdentifiers, {
			where: and(eq("subject_id", subjectId), eq("kind", "email"), eq("is_primary", true)),
		});

		if (primaryEmail) {
			if (claimNames.has("email")) idClaims.email = primaryEmail.value;
			if (claimNames.has("email_verified")) {
				idClaims.email_verified = primaryEmail.verified_at !== null;
			}
		}
	}
}

/**
 * Adds every tenant-declared custom claim whose scope was granted, to whichever
 * token(s) its `placement` names, omitting a claim entirely rather than adding it
 * as `null` when the subject holds no value for the attribute it reads.
 */
async function addCustomClaims(
	db: Database,
	accessClaims: Record<string, unknown>,
	idClaims: Record<string, unknown> | null,
	subjectId: string,
	grantedScopes: string[],
): Promise<void> {
	if (grantedScopes.length === 0) return;

	let declared = await db.findMany(customClaims, { where: inList("scope", grantedScopes) });
	if (declared.length === 0) return;

	for (let claim of declared) {
		let attribute = await db.find(subjectAttributes, {
			subject_id: subjectId,
			key: claim.attribute_key,
		});
		if (!attribute) continue;

		if (claim.placement === "access_token" || claim.placement === "both") {
			accessClaims[claim.name] = attribute.value;
		}

		if (idClaims && (claim.placement === "id_token" || claim.placement === "both")) {
			idClaims[claim.name] = attribute.value;
		}
	}
}

/**
 * Adds the `roles` claim naming the role key a subject holds at the token's scopes —
 * the tenant scope every session resolves, plus one more for the active organization
 * when the session carries one — to the access token, and to the ID token when the
 * grant mints one. Every grant reaches this, not only an `openid` one: a role is a
 * fact about the session, not about whether an identity token was asked for. A
 * client whose `include_permissions` switch is on also gets a `permissions` claim,
 * the union of what those same roles grant, resolved in the same turn the token is
 * minted.
 */
async function addRoleClaims(
	db: Database,
	accessClaims: Record<string, unknown>,
	idClaims: Record<string, unknown> | null,
	subjectId: string,
	activeOrganizationId: string | null,
	includePermissions: boolean,
): Promise<void> {
	let resolved = await resolveRoleAndPermissionClaims(db, { subjectId, activeOrganizationId });

	accessClaims.roles = resolved.roleKeys;
	if (idClaims) idClaims.roles = resolved.roleKeys;

	if (includePermissions) {
		accessClaims.permissions = resolved.permissionKeys;
		if (idClaims) idClaims.permissions = resolved.permissionKeys;
	}
}

export interface MintTokensInput {
	issuer: string;
	client: ClientRow;
	subjectId: string;
	sessionId: string;
	amr: string[];
	authTime: number;
	nonce: string | null;
	scopes: string[];
	now: number;
	/** The session's own active organization, named in the `org` claim when the granted scopes cover it. */
	activeOrganizationId: string | null;
}

export type MintTokensResult =
	| { kind: "minted"; accessToken: string; idToken: string | null; expiresIn: number }
	| { kind: "error"; status: 500; error: "server_error"; description: string };

/**
 * Builds and signs the access token and, when the grant covers `openid`, the ID
 * token, injecting custom claims and the scope-gated profile claims along the
 * way. The one step every successful grant runs through, so the two token kinds
 * are assembled identically regardless of which grant minted them.
 *
 * Exported so a grant whose subject, session and scopes come from somewhere
 * other than a live session or a fresh authorization — a device authorization's
 * own recorded approval, for one — mints through this exact step rather than a
 * second copy of it.
 */
export async function mintTokens(db: Database, input: MintTokensInput): Promise<MintTokensResult> {
	let keyPair = await currentSigningKeyPair(db);
	if (!keyPair) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "No signing key is available for this tenant.",
		};
	}

	let issuedAt = Math.floor(input.now / 1000);
	let accessExpiresAt = issuedAt + Math.floor(ACCESS_TOKEN_TTL_MS / 1000);

	let accessClaims: Record<string, unknown> = {
		iss: input.issuer,
		sub: input.subjectId,
		aud: `${input.issuer}/userinfo`,
		iat: issuedAt,
		exp: accessExpiresAt,
		jti: accessTokenId(generateUUID()).toString(),
		client_id: input.client.id,
		scope: input.scopes.join(" "),
		sid: input.sessionId,
	};

	let idClaims: Record<string, unknown> | null = null;

	if (input.scopes.includes("openid")) {
		idClaims = {
			iss: input.issuer,
			sub: input.subjectId,
			aud: input.client.id,
			iat: issuedAt,
			exp: issuedAt + Math.floor(ID_TOKEN_TTL_MS / 1000),
			auth_time: Math.floor(input.authTime / 1000),
			amr: input.amr,
			sid: input.sessionId,
		};
		if (input.nonce) idClaims.nonce = input.nonce;

		await addStandardProfileClaims(db, idClaims, input.subjectId, input.scopes);
	}

	await addRoleClaims(
		db,
		accessClaims,
		idClaims,
		input.subjectId,
		input.activeOrganizationId,
		input.client.include_permissions,
	);

	await addCustomClaims(db, accessClaims, idClaims, input.subjectId, input.scopes);

	// A session with no active organization mints no `org` claim at all, and a granted
	// scope set that never asked for `organization` gets none either — both existing
	// facts about every session today, so this stays purely additive.
	if (input.activeOrganizationId !== null && input.scopes.includes("organization")) {
		accessClaims.org = input.activeOrganizationId;
		if (idClaims) idClaims.org = input.activeOrganizationId;
	}

	let accessToken = await new AccessToken(accessClaims).sign(JWK.Algorithm.ES256, [keyPair]);

	let idToken: string | null = null;
	if (idClaims) {
		let idTokenKey = await idTokenSigningKey(db, input.client, keyPair, input.now);
		idToken = await new IdToken(idClaims).sign(idTokenKey.alg, [idTokenKey]);
	}

	return {
		kind: "minted",
		accessToken,
		idToken,
		expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
	};
}

/**
 * The key a client's ID token is signed with: the access token's ES256 key, or the
 * RS256 signing key for a client registered for RS256, generated on first use for a
 * tenant provisioned before RS256 keys existed. The JWKS is read from the tenant on
 * every request, so a relying party meeting the new `kid` finds it published.
 */
async function idTokenSigningKey(
	db: Database,
	client: ClientRow,
	accessTokenKey: JWK.KeyPair,
	now: number,
): Promise<JWK.KeyPair> {
	if (client.id_token_signed_response_alg !== JWK.Algorithm.RS256) return accessTokenKey;

	await ensureSigningKey(db, now, JWK.Algorithm.RS256);
	let keyPair = await currentSigningKeyPair(db, JWK.Algorithm.RS256);
	if (!keyPair) throw new Error("RS256 signing key missing immediately after ensuring one");

	return keyPair;
}

/** Revokes every row in a refresh token family, for a reuse response or a replayed code alike. */
export async function revokeFamily(db: Database, familyId: string, now: number): Promise<void> {
	await db.updateMany(refreshTokenRows, { revoked_at: now }, { where: eq("family_id", familyId) });
}

export interface IssueRefreshTokenInput {
	familyId: string;
	parentHash: string | null;
	clientId: string;
	subjectId: string;
	sessionId: string;
	scopes: string[];
	now: number;
	absoluteExpiresAt: number;
}

/** Mints a refresh token, storing only its digest, and writes the row it redeems from next time. */
export async function issueRefreshToken(
	db: Database,
	input: IssueRefreshTokenInput,
): Promise<{ token: string }> {
	let token = randomToken({ bytes: 32, prefix: "rt" });
	let hashed = await sha256(token);
	if (isFailure(hashed)) throw new Error("refresh token hashing failed");

	await db.create(refreshTokenRows, {
		token_hash: Hex.encode(hashed.data),
		family_id: input.familyId,
		parent_hash: input.parentHash,
		client_id: input.clientId,
		subject_id: input.subjectId,
		session_id: input.sessionId,
		scopes: input.scopes,
		created_at: input.now,
		expires_at: input.now + REFRESH_TOKEN_TTL_MS,
		absolute_expires_at: input.absoluteExpiresAt,
		redeemed_at: null,
		revoked_at: null,
	});

	return { token };
}

/** What a code or a refresh token's session lookup needs: its `amr`, `auth_time` and active organization. */
interface SessionAmrAndAuthTime {
	amr: string[];
	auth_time: number;
	active_organization_id: string | null;
}

/** The session row a code or a refresh token names, or a bare fallback for one that no longer resolves. */
async function sessionFor(db: Database, sessionId: string): Promise<SessionAmrAndAuthTime> {
	let row = await db.find(sessions, { id: sessionId });
	return row
		? {
				amr: row.amr as string[],
				auth_time: row.auth_time,
				active_organization_id: row.active_organization_id,
			}
		: { amr: [], auth_time: Date.now(), active_organization_id: null };
}

export interface ExchangeCodeInput {
	code: string;
	codeVerifier: string;
	redirectUri: string;
	clientId: string;
	clientSecret: string | null;
	authScheme: AuthScheme;
	now: number;
	/** The tenant's own issuer, stamped onto every token as `iss`. */
	issuer: string;
}

let ExchangeCodeSchema = s.object({
	code: s.string(),
	codeVerifier: s.string(),
	redirectUri: s.string(),
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: AuthSchemeSchema,
	now: s.number(),
	issuer: s.string(),
});

/**
 * Turns an authorization code into a token set, the whole exchange in one round
 * trip: authenticate the client, redeem the code atomically, verify its bindings
 * and its PKCE challenge, mint and sign, and — when the grant covers
 * `offline_access` — start a refresh token family. A code minted for a subject
 * who is since blocked refuses exactly like an unknown or already-used code,
 * giving nothing away about which case it hit.
 *
 * @param db - The tenant's database.
 * @param input - The presented code and verifier, the redirect the client used,
 * the client's credentials, and the clock and issuer to mint against.
 * @returns The minted token set, or the error this exchange was refused for.
 */
export async function exchangeCode(db: Database, input: ExchangeCodeInput): Promise<TokenOutcome> {
	let parsed = s.parse(ExchangeCodeSchema, input);

	let authenticated = await authenticateClient(db, parsed);
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}
	let client = authenticated.client;

	let hashed = await sha256(parsed.code);
	if (isFailure(hashed)) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "Failed to process the authorization code.",
		};
	}
	let codeHash = Hex.encode(hashed.data);

	// No await runs between hashing the presented code and this statement, so the
	// check-and-claim is one atomic step: two concurrent exchanges of the same
	// code cannot both see `redeemed_at` still null.
	let redemption = await db
		.query(authorizationCodes)
		.where(and(eq("code_hash", codeHash), isNull("redeemed_at"), gt("expires_at", parsed.now)))
		.update({ redeemed_at: parsed.now }, { returning: "*" });

	let redeemedRow = "rows" in redemption ? (redemption.rows[0] ?? null) : null;

	if (!redeemedRow) {
		let existing = await db.findOne(authorizationCodes, { where: { code_hash: codeHash } });

		if (existing !== null && existing.redeemed_at !== null && existing.token_family_id !== null) {
			await revokeFamily(db, existing.token_family_id, parsed.now);
		}

		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "This code is unknown, expired, or already used.",
		};
	}

	if (redeemedRow.client_id !== client.id || redeemedRow.redirect_uri !== parsed.redirectUri) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "The client or redirect target does not match this code.",
		};
	}

	let verifierHash = await sha256(parsed.codeVerifier);
	if (
		isFailure(verifierHash) ||
		Base64Url.encode(verifierHash.data) !== redeemedRow.code_challenge
	) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "The code verifier does not match this code.",
		};
	}

	let subject = await db.find(subjects, { id: redeemedRow.subject_id });
	if (subject?.status === "blocked") {
		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "This code is unknown, expired, or already used.",
		};
	}

	let grantedScopes = redeemedRow.scopes as string[];
	let session = await sessionFor(db, redeemedRow.session_id);

	let minted = await mintTokens(db, {
		issuer: parsed.issuer,
		client,
		subjectId: redeemedRow.subject_id,
		sessionId: redeemedRow.session_id,
		amr: session.amr,
		authTime: redeemedRow.auth_time,
		nonce: redeemedRow.nonce,
		scopes: grantedScopes,
		now: parsed.now,
		activeOrganizationId: session.active_organization_id,
	});
	if (minted.kind === "error") return minted;

	let refreshToken: string | null = null;

	if (grantedScopes.includes("offline_access")) {
		let familyId = refreshTokenFamilyId(generateUUID()).toString();

		let issued = await issueRefreshToken(db, {
			familyId,
			parentHash: null,
			clientId: client.id,
			subjectId: redeemedRow.subject_id,
			sessionId: redeemedRow.session_id,
			scopes: grantedScopes,
			now: parsed.now,
			absoluteExpiresAt: parsed.now + REFRESH_TOKEN_FAMILY_TTL_MS,
		});
		refreshToken = issued.token;

		// Named on the code's own row so a replay of this same code, however much
		// later, still finds the family a reuse response revokes.
		await db.update(authorizationCodes, { id: redeemedRow.id }, { token_family_id: familyId });
	}

	return {
		kind: "tokens",
		accessToken: minted.accessToken,
		idToken: minted.idToken,
		refreshToken,
		tokenType: "Bearer",
		expiresIn: minted.expiresIn,
		scope: grantedScopes.join(" "),
	};
}

export interface RefreshTokensInput {
	refreshToken: string;
	scope: string | null;
	clientId: string;
	clientSecret: string | null;
	authScheme: AuthScheme;
	now: number;
	/** The tenant's own issuer, stamped onto every token as `iss`. */
	issuer: string;
}

let RefreshTokensSchema = s.object({
	refreshToken: s.string(),
	scope: s.nullable(s.string()),
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: AuthSchemeSchema,
	now: s.number(),
	issuer: s.string(),
});

/**
 * Rotates a refresh token: authenticate the client, redeem the presented token
 * atomically (scoped to the authenticated client, so a token belonging to
 * another one is never claimed), mint a fresh token set for the same or a
 * narrower scope, and issue the family's next token. Presenting a token a
 * second time revokes the whole family and ends the session behind it, then
 * answers exactly like an expired token would. A token redeemed for a subject
 * who is since blocked gets the same treatment: the family and session are
 * revoked and the call refuses exactly like an expired token, so the token is
 * fully neutralized on the first attempt to use it rather than merely refused.
 *
 * @param db - The tenant's database.
 * @param input - The presented refresh token, an optional narrower scope, the
 * client's credentials, and the clock and issuer to mint against.
 * @returns The minted token set, or the error this rotation was refused for.
 */
export async function refreshTokens(
	db: Database,
	input: RefreshTokensInput,
): Promise<TokenOutcome> {
	let parsed = s.parse(RefreshTokensSchema, input);

	let authenticated = await authenticateClient(db, parsed);
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}
	let client = authenticated.client;

	let hashed = await sha256(parsed.refreshToken);
	if (isFailure(hashed)) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "Failed to process the refresh token.",
		};
	}
	let tokenHash = Hex.encode(hashed.data);

	// No await runs between hashing the presented token and this statement. The
	// client id is part of the same atomic check, so a token minted for another
	// client is never claimed here rather than claimed and then rejected.
	let redemption = await db
		.query(refreshTokenRows)
		.where(
			and(
				eq("token_hash", tokenHash),
				eq("client_id", client.id),
				isNull("redeemed_at"),
				isNull("revoked_at"),
				gt("expires_at", parsed.now),
				gt("absolute_expires_at", parsed.now),
			),
		)
		.update({ redeemed_at: parsed.now }, { returning: "*" });

	let redeemedRow = "rows" in redemption ? (redemption.rows[0] ?? null) : null;

	if (!redeemedRow) {
		let existing = await db.findOne(refreshTokenRows, { where: { token_hash: tokenHash } });

		if (existing !== null && existing.redeemed_at !== null) {
			// Both an attacker and the legitimate client may hold this token, and
			// there is no way to tell which one just presented it, so the whole
			// family and the session behind it end rather than only this token.
			await revokeFamily(db, existing.family_id, parsed.now);
			await revokeSession(db, {
				subjectId: existing.subject_id,
				sessionId: existing.session_id,
				reason: "refresh_token_reuse",
			});
		}

		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "This refresh token is unknown, expired, or no longer valid.",
		};
	}

	let grantedScopes = redeemedRow.scopes as string[];
	let requestedScopes = parsed.scope ? parsed.scope.split(/\s+/).filter(Boolean) : grantedScopes;

	if (requestedScopes.some((scope) => !grantedScopes.includes(scope))) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_scope",
			description: "The requested scope is not a subset of this token's own scope.",
		};
	}

	let subject = await db.find(subjects, { id: redeemedRow.subject_id });
	if (subject?.status === "blocked") {
		// The presented token is already consumed by the redemption above either way,
		// so revoking the whole family and the session behind it here neutralizes a
		// blocked subject's refresh token on first use rather than leaving it merely
		// refused for a later attempt to trip over again.
		await revokeFamily(db, redeemedRow.family_id, parsed.now);
		await revokeSession(db, {
			subjectId: redeemedRow.subject_id,
			sessionId: redeemedRow.session_id,
			reason: "subject_blocked",
		});

		return {
			kind: "error",
			status: 400,
			error: "invalid_grant",
			description: "This refresh token is unknown, expired, or no longer valid.",
		};
	}

	let session = await sessionFor(db, redeemedRow.session_id);

	let minted = await mintTokens(db, {
		issuer: parsed.issuer,
		client,
		subjectId: redeemedRow.subject_id,
		sessionId: redeemedRow.session_id,
		amr: session.amr,
		authTime: session.auth_time,
		nonce: null,
		scopes: requestedScopes,
		now: parsed.now,
		activeOrganizationId: session.active_organization_id,
	});
	if (minted.kind === "error") return minted;

	let issued = await issueRefreshToken(db, {
		familyId: redeemedRow.family_id,
		parentHash: redeemedRow.token_hash,
		clientId: client.id,
		subjectId: redeemedRow.subject_id,
		sessionId: redeemedRow.session_id,
		scopes: requestedScopes,
		now: parsed.now,
		absoluteExpiresAt: redeemedRow.absolute_expires_at,
	});

	return {
		kind: "tokens",
		accessToken: minted.accessToken,
		idToken: minted.idToken,
		refreshToken: issued.token,
		tokenType: "Bearer",
		expiresIn: minted.expiresIn,
		scope: requestedScopes.join(" "),
	};
}

export interface IssueClientCredentialsTokenInput {
	scope: string | null;
	resource: string | null;
	clientId: string;
	clientSecret: string | null;
	authScheme: "basic" | "post";
	now: number;
	/** The tenant's own issuer, stamped onto the token as `iss` and, absent a named resource, as its `aud`. */
	issuer: string;
}

let IssueClientCredentialsTokenSchema = s.object({
	scope: s.nullable(s.string()),
	resource: s.nullable(s.string()),
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: s.enum_(["basic", "post"] as const),
	now: s.number(),
	issuer: s.string(),
});

/**
 * Exchanges a client id and secret for a token about the client itself: no
 * subject, no session, no ID token and no refresh token, because the client
 * holds the credential that mints the next one. `authenticateClient` already
 * refuses a public client presenting `basic`/`post` — it holds no secret to
 * authenticate with — so the grant reaches only a confidential client, the one
 * kind whose whole security is the secret it just proved.
 *
 * @param db - The tenant's database.
 * @param input - The client's credentials, the scope and resource requested,
 * and the clock and issuer to mint against.
 * @returns The minted access token, or the error this grant was refused for.
 */
export async function issueClientCredentialsToken(
	db: Database,
	input: IssueClientCredentialsTokenInput,
): Promise<TokenOutcome> {
	let parsed = s.parse(IssueClientCredentialsTokenSchema, input);

	let authenticated = await authenticateClient(db, parsed);
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}
	let client = authenticated.client;

	if (!(client.grant_types as string[]).includes("client_credentials")) {
		return {
			kind: "error",
			status: 400,
			error: "unauthorized_client",
			description: "This application is not registered for the client credentials grant.",
		};
	}

	let ceiling = client.scopes as string[];
	let grantedScopes = parsed.scope ? parsed.scope.split(/\s+/).filter(Boolean) : ceiling;
	if (grantedScopes.some((scope) => !ceiling.includes(scope))) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_scope",
			description: "One or more requested scopes are not allowed for this application.",
		};
	}

	let keyPair = await currentSigningKeyPair(db);
	if (!keyPair) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "No signing key is available for this tenant.",
		};
	}

	let issuedAt = Math.floor(parsed.now / 1000);

	let accessToken = await new AccessToken({
		iss: parsed.issuer,
		sub: client.id,
		client_id: client.id,
		aud: parsed.resource ?? `${parsed.issuer}/userinfo`,
		iat: issuedAt,
		exp: issuedAt + Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
		jti: accessTokenId(generateUUID()).toString(),
		scope: grantedScopes.join(" "),
	}).sign(JWK.Algorithm.ES256, [keyPair]);

	return {
		kind: "tokens",
		accessToken,
		idToken: null,
		refreshToken: null,
		tokenType: "Bearer",
		expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
		scope: grantedScopes.join(" "),
	};
}

export interface SweepExpiredRefreshTokensInput {
	now?: number;
	batchSize?: number;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredRefreshTokensResult {
	deleted: number;
	more: boolean;
}

let SweepExpiredRefreshTokensSchema = s.object({
	now: s.optional(s.number()),
	batchSize: s.optional(s.number()),
});

/**
 * Deletes refresh tokens whose family is past its ninety-day absolute ceiling,
 * in one bounded batch, for the scheduled handler driving retention.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a
 * caller sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredRefreshTokens(
	db: Database,
	input: SweepExpiredRefreshTokensInput = {},
): Promise<SweepExpiredRefreshTokensResult> {
	let parsed = s.parse(SweepExpiredRefreshTokensSchema, input);
	let now = parsed.now ?? Date.now();
	let batchSize = parsed.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(refreshTokenRows, {
		where: lt("absolute_expires_at", now),
		orderBy: ["absolute_expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(refreshTokenRows, {
		where: inList(
			"token_hash",
			batch.map((row) => row.token_hash),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
