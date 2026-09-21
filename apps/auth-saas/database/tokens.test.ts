/**
 * Drives `tokens.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `authorization.test.ts` and `clients.test.ts` drive their
 * own modules: nothing here can wire a new RPC method onto the tenant object, so
 * these functions are exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { RegisterClientInput } from "./clients";

import { authorizationCodes } from "./authorization";
import { registerClient } from "./clients";
import { openSession, resolveSession } from "./sessions";
import { currentSigningKeyPair, ensureSigningKey, setCustomClaims } from "./signing-keys";
import { createSubject, subjectAttributes } from "./subjects";
import { runMigrations } from "./tenant-migrations";
import tokensMigration from "./tenant-migrations/0010-tokens.sql?raw";
import {
	AccessToken,
	exchangeCode,
	IdToken,
	refreshTokenRows,
	refreshTokens,
	sweepExpiredRefreshTokens,
} from "./tokens";

/** The tenant's own issuer, stamped onto every minted token as `iss`. */
const ISSUER = "https://tenant.example.com";

/** The default redirect URI every test client registers. */
const REDIRECT_URI = "https://example.com/callback";

/** A day, in milliseconds, for spelling out the token lifetimes under test. */
const DAY_MS = 24 * 60 * 60 * 1000;

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	await driver.executeScript(tokensMigration);
	db = new Database(driver);
	await ensureSigningKey(db);
});

/** Digests text with SHA-256, throwing rather than returning a `Result`, for test setup. */
async function digestHex(text: string): Promise<string> {
	let hashed = await sha256(text);
	if (isFailure(hashed)) throw new Error("unreachable");
	return Hex.encode(hashed.data);
}

/** Registers a client, throwing if the record was refused, for tests that need one already made. */
async function createTestClient(overrides: Partial<RegisterClientInput> = {}) {
	let result = await registerClient(db, {
		name: "Test Client",
		kind: "confidential",
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code", "refresh_token"],
		responseTypes: ["code"],
		scopes: ["openid", "profile", "email", "offline_access"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
		...overrides,
	});
	if (!result.ok) throw new Error("unreachable");
	return { client: result.client, secret: result.secret };
}

/** Creates a bare subject, optionally with profile claims, the shape most tests need one for. */
let nextTestSubjectSuffix = 0;

async function createTestSubject(profile: Record<string, unknown> = {}): Promise<string> {
	let username = `jane-${nextTestSubjectSuffix++}`;
	let created = await createSubject(db, {
		identifiers: [{ kind: "username", value: username }],
		profile,
	});
	if (!created.ok) throw new Error("unreachable");
	return created.subjectId;
}

/** Opens a session for a subject, returning what a code or a refresh token needs to name. */
async function openTestSession(subjectId: string) {
	return openSession(db, { subjectId, amr: ["pwd"], remembered: true });
}

interface TestCodeOverrides {
	clientId: string;
	subjectId: string;
	sessionId: string;
	redirectUri?: string;
	scopes?: string[];
	nonce?: string | null;
	authTime?: number;
	now?: number;
	expiresAt?: number;
	redeemedAt?: number | null;
	tokenFamilyId?: string | null;
}

/**
 * Writes an authorization code row directly, with the code and its PKCE verifier
 * in hand, so a test controls every one of the redemption's bindings without
 * first driving the whole `/authorize` flow.
 */
async function createTestCode(
	overrides: TestCodeOverrides,
): Promise<{ code: string; codeVerifier: string }> {
	let code = `code-${generateUUID()}`;
	let codeVerifier = `verifier-${generateUUID()}`;
	let verifierHashed = await sha256(codeVerifier);
	if (isFailure(verifierHashed)) throw new Error("unreachable");
	let codeChallenge = Base64Url.encode(verifierHashed.data);

	let now = overrides.now ?? Date.now();

	await db.create(authorizationCodes, {
		id: generateUUID(),
		code_hash: await digestHex(code),
		client_id: overrides.clientId,
		redirect_uri: overrides.redirectUri ?? REDIRECT_URI,
		code_challenge: codeChallenge,
		scopes: overrides.scopes ?? ["openid"],
		subject_id: overrides.subjectId,
		session_id: overrides.sessionId,
		nonce: overrides.nonce ?? null,
		auth_time: overrides.authTime ?? now,
		created_at: now,
		expires_at: overrides.expiresAt ?? now + 60_000,
		redeemed_at: overrides.redeemedAt ?? null,
		token_family_id: overrides.tokenFamilyId ?? null,
	});

	return { code, codeVerifier };
}

/** A full client + subject + session + code fixture, for tests that just want a working exchange. */
async function fullFixture(scopes: string[] = ["openid"], now = Date.now()) {
	let { client, secret } = await createTestClient();
	let subjectId = await createTestSubject();
	let session = await openTestSession(subjectId);
	let { code, codeVerifier } = await createTestCode({
		clientId: client.id,
		subjectId,
		sessionId: session.sessionId,
		scopes,
		now,
	});
	return { client, secret, subjectId, session, code, codeVerifier, now };
}

describe("client authentication", () => {
	test("a public client authenticates with authScheme none", async () => {
		let { client } = await createTestClient({ kind: "public", tokenEndpointAuthMethod: "none" });
		let subjectId = await createTestSubject();
		let session = await openTestSession(subjectId);
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: null,
			authScheme: "none",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
	});

	test("a confidential client authenticates with its registered scheme and secret", async () => {
		let { client, secret } = await createTestClient();
		let subjectId = await createTestSubject();
		let session = await openTestSession(subjectId);
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
	});

	test("presenting the wrong scheme for a client's registered method is invalid_client", async () => {
		let { client, secret } = await createTestClient({
			tokenEndpointAuthMethod: "client_secret_basic",
		});

		let outcome = await exchangeCode(db, {
			code: "does-not-matter",
			codeVerifier: "does-not-matter",
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "post",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_client" });
	});

	test("a wrong secret is invalid_client at 401 when presented via the Authorization header", async () => {
		let { client } = await createTestClient();

		let outcome = await exchangeCode(db, {
			code: "does-not-matter",
			codeVerifier: "does-not-matter",
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: "wrong-secret",
			authScheme: "basic",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 401, error: "invalid_client" });
	});

	test("an unknown client is invalid_client at 401 when presented via the Authorization header", async () => {
		let outcome = await exchangeCode(db, {
			code: "does-not-matter",
			codeVerifier: "does-not-matter",
			redirectUri: REDIRECT_URI,
			clientId: "client_does_not_exist",
			clientSecret: "whatever",
			authScheme: "basic",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 401, error: "invalid_client" });
	});

	test("a confidential client presenting none is invalid_client", async () => {
		let { client } = await createTestClient();

		let outcome = await exchangeCode(db, {
			code: "does-not-matter",
			codeVerifier: "does-not-matter",
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: null,
			authScheme: "none",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_client" });
	});
});

describe("exchangeCode", () => {
	test("mints an access token and an ID token carrying ADR-010's claims", async () => {
		let now = 1_700_000_000_000;
		let subjectId = await createTestSubject({ name: "Jane Doe", givenName: "Jane" });
		let { client, secret } = await createTestClient();
		let session = await openTestSession(subjectId);
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
			scopes: ["openid", "profile", "email"],
			nonce: "the-nonce",
			authTime: now - 5_000,
			now,
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
		if (outcome.kind !== "tokens") throw new Error("unreachable");

		let accessToken = AccessToken.decode(outcome.accessToken);
		expect(accessToken.issuer).toBe(ISSUER);
		expect(accessToken.subject).toBe(subjectId);
		expect(accessToken.audience).toBe(`${ISSUER}/userinfo`);
		expect(accessToken.clientId).toBe(client.id);
		expect(accessToken.scope).toBe("openid profile email");
		expect(accessToken.sessionId).toBe(session.sessionId);
		expect(accessToken.id).toEqual(expect.any(String));
		expect(accessToken.expirationTime).toBe(Math.floor(now / 1000) + 60 * 60);

		expect(outcome.idToken).toEqual(expect.any(String));
		if (!outcome.idToken) throw new Error("unreachable");
		let idToken = IdToken.decode(outcome.idToken);
		expect(idToken.issuer).toBe(ISSUER);
		expect(idToken.subject).toBe(subjectId);
		expect(idToken.audience).toBe(client.id);
		expect(idToken.nonce).toBe("the-nonce");
		expect(idToken.amr).toEqual(["pwd"]);
		expect(idToken.sessionId).toBe(session.sessionId);
		expect(idToken.authTime.getTime()).toBe(now - 5_000 - ((now - 5_000) % 1000));
		expect(idToken.expirationTime).toBe(Math.floor(now / 1000) + 10 * 60);
		expect(idToken.payload.name).toBe("Jane Doe");
		expect(idToken.payload.given_name).toBe("Jane");

		expect(outcome.expiresIn).toBe(60 * 60);
		expect(outcome.scope).toBe("openid profile email");
		expect(outcome.tokenType).toBe("Bearer");
	});

	test("the minted access token verifies against the tenant's current signing key", async () => {
		let { client, secret, code, codeVerifier, now } = await fullFixture();

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});
		if (outcome.kind !== "tokens") throw new Error("unreachable");

		let keyPair = await currentSigningKeyPair(db);
		if (!keyPair) throw new Error("unreachable");

		let verified = await AccessToken.verify(outcome.accessToken, [keyPair], { issuer: ISSUER });
		expect(verified.subject).toEqual(expect.any(String));
	});

	test("does not mint an ID token when the grant does not cover openid", async () => {
		let { client, secret } = await createTestClient();
		let subjectId = await createTestSubject();
		let session = await openTestSession(subjectId);
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
			scopes: ["profile"],
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
		if (outcome.kind !== "tokens") throw new Error("unreachable");
		expect(outcome.idToken).toBeNull();
	});

	test("offline_access mints a refresh token, starting a fresh family", async () => {
		let { client, secret, code, codeVerifier, now } = await fullFixture([
			"openid",
			"offline_access",
		]);

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
		if (outcome.kind !== "tokens") throw new Error("unreachable");
		expect(outcome.refreshToken).toEqual(expect.any(String));

		let rows = await db.findMany(refreshTokenRows);
		expect(rows).toHaveLength(1);
		let row = rows[0];
		if (!row) throw new Error("unreachable");
		expect(row.parent_hash).toBeNull();
		expect(row.client_id).toBe(client.id);
		expect(row.absolute_expires_at).toBe(now + 90 * DAY_MS);
		expect(row.expires_at).toBe(now + 30 * DAY_MS);
	});

	test("no offline_access mints no refresh token", async () => {
		let { client, secret, code, codeVerifier, now } = await fullFixture(["openid"]);

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
		if (outcome.kind !== "tokens") throw new Error("unreachable");
		expect(outcome.refreshToken).toBeNull();
		expect(await db.findMany(refreshTokenRows)).toHaveLength(0);
	});

	test("a mismatched PKCE verifier is invalid_grant", async () => {
		let { client, secret, code, now } = await fullFixture();

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier: "the-wrong-verifier",
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_grant" });
	});

	test("a redirect_uri that does not match the code's binding is invalid_grant", async () => {
		let { client, secret, code, codeVerifier, now } = await fullFixture();

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: "https://evil.example.com/callback",
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_grant" });
	});

	test("a client_id that does not match the code's binding is invalid_grant", async () => {
		let { client: codeOwner, code, codeVerifier, now } = await fullFixture();
		let { client: otherClient, secret: otherSecret } = await createTestClient();

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: otherClient.id,
			clientSecret: otherSecret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_grant" });
		expect(codeOwner.id).not.toBe(otherClient.id);
	});

	test("an expired code is invalid_grant", async () => {
		let now = 1_700_000_000_000;
		let { client, secret } = await createTestClient();
		let subjectId = await createTestSubject();
		let session = await openTestSession(subjectId);
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
			now,
			expiresAt: now - 1,
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_grant" });
	});

	test("replaying an already-redeemed code revokes the family named on its row", async () => {
		let { client, secret, code, codeVerifier, now } = await fullFixture([
			"openid",
			"offline_access",
		]);

		let first = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});
		expect(first.kind).toBe("tokens");

		let replay = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: now + 1_000,
			issuer: ISSUER,
		});

		expect(replay).toMatchObject({ kind: "error", status: 400, error: "invalid_grant" });

		let rows = await db.findMany(refreshTokenRows);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.revoked_at).not.toBeNull();
	});
});

/** Exchanges a fresh code for a token set that includes a refresh token. */
async function issueTestRefreshToken(
	scopes: string[] = ["openid", "offline_access"],
	now = Date.now(),
) {
	let { client, secret, subjectId, session, code, codeVerifier } = await fullFixture(scopes, now);

	let outcome = await exchangeCode(db, {
		code,
		codeVerifier,
		redirectUri: REDIRECT_URI,
		clientId: client.id,
		clientSecret: secret,
		authScheme: "basic",
		now,
		issuer: ISSUER,
	});
	if (outcome.kind !== "tokens" || !outcome.refreshToken) throw new Error("unreachable");

	return { client, secret, subjectId, session, refreshToken: outcome.refreshToken, now };
}

describe("refreshTokens", () => {
	test("rotates into a new token in the same family, chained by parent_hash", async () => {
		let { client, secret, refreshToken, now } = await issueTestRefreshToken();
		let firstHash = await digestHex(refreshToken);

		let outcome = await refreshTokens(db, {
			refreshToken,
			scope: null,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: now + 1_000,
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
		if (outcome.kind !== "tokens") throw new Error("unreachable");
		expect(outcome.refreshToken).toEqual(expect.any(String));
		expect(outcome.refreshToken).not.toBe(refreshToken);

		let rows = await db.findMany(refreshTokenRows);
		expect(rows).toHaveLength(2);

		let original = rows.find((row) => row.token_hash === firstHash);
		expect(original?.redeemed_at).toBe(now + 1_000);

		let next = rows.find((row) => row.token_hash !== firstHash);
		expect(next?.parent_hash).toBe(firstHash);
		expect(next?.family_id).toBe(original?.family_id);
		expect(next?.absolute_expires_at).toBe(original?.absolute_expires_at);
	});

	test("narrows the granted scope on request", async () => {
		let { client, secret, refreshToken, now } = await issueTestRefreshToken([
			"openid",
			"profile",
			"offline_access",
		]);

		let outcome = await refreshTokens(db, {
			refreshToken,
			scope: "openid",
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: now + 1_000,
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
		if (outcome.kind !== "tokens") throw new Error("unreachable");
		expect(outcome.scope).toBe("openid");
	});

	test("refuses a scope wider than the token's own grant", async () => {
		let { client, secret, refreshToken, now } = await issueTestRefreshToken([
			"openid",
			"offline_access",
		]);

		let outcome = await refreshTokens(db, {
			refreshToken,
			scope: "openid profile",
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: now + 1_000,
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_scope" });
	});

	test("reusing a redeemed refresh token revokes the whole family and ends the session", async () => {
		let { client, secret, session, refreshToken, now } = await issueTestRefreshToken();

		let rotated = await refreshTokens(db, {
			refreshToken,
			scope: null,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: now + 1_000,
			issuer: ISSUER,
		});
		expect(rotated.kind).toBe("tokens");

		let reuse = await refreshTokens(db, {
			refreshToken,
			scope: null,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: now + 2_000,
			issuer: ISSUER,
		});

		expect(reuse).toMatchObject({ kind: "error", status: 400, error: "invalid_grant" });

		let rows = await db.findMany(refreshTokenRows);
		expect(rows.length).toBeGreaterThan(0);
		for (let row of rows) expect(row.revoked_at).not.toBeNull();

		let resolved = await resolveSession(db, { token: session.token });
		expect(resolved.status).not.toBe("active");
	});

	test("refuses a rotation once the family's absolute expiry has passed", async () => {
		let start = 1_700_000_000_000;
		let { client, secret, refreshToken } = await issueTestRefreshToken(
			["openid", "offline_access"],
			start,
		);

		// Rotate every twenty-five days — inside each token's own thirty-day idle
		// window — until the family sits just under its ninety-day ceiling, so the
		// final token's own idle clock stays well ahead of `now` below and only
		// the absolute ceiling can be what refuses the next rotation.
		let current = refreshToken;
		for (let elapsedDays of [25, 50, 75]) {
			let rotated = await refreshTokens(db, {
				refreshToken: current,
				scope: null,
				clientId: client.id,
				clientSecret: secret,
				authScheme: "basic",
				now: start + elapsedDays * DAY_MS,
				issuer: ISSUER,
			});
			expect(rotated.kind).toBe("tokens");
			if (rotated.kind !== "tokens" || !rotated.refreshToken) throw new Error("unreachable");
			current = rotated.refreshToken;
		}

		let pastCeiling = start + 91 * DAY_MS;
		let outcome = await refreshTokens(db, {
			refreshToken: current,
			scope: null,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: pastCeiling,
			issuer: ISSUER,
		});

		expect(outcome).toMatchObject({ kind: "error", status: 400, error: "invalid_grant" });
	});
});

describe("custom claims", () => {
	test("lands a claim on the token(s) its placement names, and omits it when the subject has no value", async () => {
		await setCustomClaims(db, {
			claims: [
				{
					name: "https://example.com/department",
					attributeKey: "department",
					placement: "both",
					scope: "profile",
				},
				{
					name: "https://example.com/access-only",
					attributeKey: "access_flag",
					placement: "access_token",
					scope: "profile",
				},
				{
					name: "https://example.com/id-only",
					attributeKey: "id_flag",
					placement: "id_token",
					scope: "profile",
				},
			],
		});

		let now = Date.now();
		let { client, secret } = await createTestClient();
		let subjectId = await createTestSubject();

		await db.create(subjectAttributes, {
			subject_id: subjectId,
			key: "department",
			value: "engineering",
			created_at: now,
			updated_at: now,
		});
		await db.create(subjectAttributes, {
			subject_id: subjectId,
			key: "access_flag",
			value: "yes",
			created_at: now,
			updated_at: now,
		});
		await db.create(subjectAttributes, {
			subject_id: subjectId,
			key: "id_flag",
			value: "yes",
			created_at: now,
			updated_at: now,
		});
		// No value written for "id_flag" would be the omission case; instead prove
		// omission with a subject that never gets an attribute row at all, below.

		let session = await openTestSession(subjectId);
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
			scopes: ["openid", "profile"],
			now,
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});
		if (outcome.kind !== "tokens" || !outcome.idToken) throw new Error("unreachable");

		let accessToken = AccessToken.decode(outcome.accessToken);
		let idToken = IdToken.decode(outcome.idToken);

		expect(accessToken.payload["https://example.com/department"]).toBe("engineering");
		expect(idToken.payload["https://example.com/department"]).toBe("engineering");

		expect(accessToken.payload["https://example.com/access-only"]).toBe("yes");
		expect(idToken.payload["https://example.com/access-only"]).toBeUndefined();

		expect(accessToken.payload["https://example.com/id-only"]).toBeUndefined();
		expect(idToken.payload["https://example.com/id-only"]).toBe("yes");
	});

	test("omits a declared claim entirely when the subject holds no value for its attribute", async () => {
		await setCustomClaims(db, {
			claims: [
				{
					name: "https://example.com/department",
					attributeKey: "department",
					placement: "both",
					scope: "profile",
				},
			],
		});

		let now = Date.now();
		let { client, secret } = await createTestClient();
		let subjectId = await createTestSubject();
		let session = await openTestSession(subjectId);
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
			scopes: ["openid", "profile"],
			now,
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});
		if (outcome.kind !== "tokens" || !outcome.idToken) throw new Error("unreachable");

		let accessToken = AccessToken.decode(outcome.accessToken);
		let idToken = IdToken.decode(outcome.idToken);

		expect(accessToken.payload["https://example.com/department"]).toBeUndefined();
		expect(idToken.payload["https://example.com/department"]).toBeUndefined();
	});

	test("does not inject a claim whose scope was not granted", async () => {
		await setCustomClaims(db, {
			claims: [
				{
					name: "https://example.com/department",
					attributeKey: "department",
					placement: "both",
					scope: "profile",
				},
			],
		});

		let now = Date.now();
		let { client, secret } = await createTestClient();
		let subjectId = await createTestSubject();

		await db.create(subjectAttributes, {
			subject_id: subjectId,
			key: "department",
			value: "engineering",
			created_at: now,
			updated_at: now,
		});

		let session = await openTestSession(subjectId);
		// "profile" is deliberately left out of the granted scopes.
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId: session.sessionId,
			scopes: ["openid"],
			now,
		});

		let outcome = await exchangeCode(db, {
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now,
			issuer: ISSUER,
		});
		if (outcome.kind !== "tokens" || !outcome.idToken) throw new Error("unreachable");

		let idToken = IdToken.decode(outcome.idToken);
		expect(idToken.payload["https://example.com/department"]).toBeUndefined();
	});
});

describe("sweepExpiredRefreshTokens", () => {
	test("deletes a row whose family is past its ninety-day absolute ceiling", async () => {
		let start = 1_700_000_000_000;
		let { refreshToken } = await issueTestRefreshToken(["openid", "offline_access"], start);
		let hash = await digestHex(refreshToken);

		let pastCeiling = start + 91 * DAY_MS;
		let result = await sweepExpiredRefreshTokens(db, { now: pastCeiling });

		expect(result).toEqual({ deleted: 1, more: false });
		expect(await db.find(refreshTokenRows, { token_hash: hash })).toBeNull();
	});

	test("leaves a row still inside its family's absolute ceiling alone", async () => {
		let start = 1_700_000_000_000;
		await issueTestRefreshToken(["openid", "offline_access"], start);

		let result = await sweepExpiredRefreshTokens(db, { now: start + 1_000 });

		expect(result).toEqual({ deleted: 0, more: false });
	});
});
