/**
 * Drives the tenant Durable Object's `beginDeviceAuthorization`,
 * `redeemDeviceCode`, `beginDeviceApproval` and `decideDeviceApproval` RPC
 * methods the way `connection-sign-in.test.ts` drives its own, through a real
 * `Tenant` object rather than the module directly, since all four are wired on
 * as RPC methods. A denied or expired row still needed for a `redeemDeviceCode`
 * fixture that predates `decideDeviceApproval` is written directly against the
 * object's own storage, the same way `tenant-do.test.ts` seeds a fixture no RPC
 * can produce; an approved row is now produced by `decideDeviceApproval` itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { grants } from "./consent";
import Tenant from "./tenant-do";

/** The tenant's issuer, `verification_uri` and every minted token's `iss`. */
const ISSUER = "https://tenant.example.com";

const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

let state: DurableObjectStateMock;
let tenant: Tenant;
let db: Database;

beforeEach(async () => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
	await tenant.provision({ tenantId: "tenant_1", issuer: ISSUER });
	db = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
});

/** Creates a verified subject with a password and signs it in, for a real session `beginDeviceApproval`/`decideDeviceApproval` can resolve. */
async function createSignedInSubject(
	email: string,
	password: string,
): Promise<{ subjectId: string; sessionId: string }> {
	let created = await tenant.createSubject({ identifiers: [{ kind: "email", value: email }] });
	if (!created.ok) throw new Error("unreachable: subject creation failed");

	let added = await tenant.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable: identifier add failed");
	await tenant.verifyIdentifier({ ticket: added.ticket });

	let written = await tenant.setPassword({
		subjectId: created.subjectId,
		password,
		actor: { kind: "subject" },
	});
	if (!written.ok) throw new Error("unreachable: password set failed");

	let signedIn = await tenant.signInWithPassword({
		identifier: email,
		password,
		remembered: false,
	});
	if (!signedIn.ok) throw new Error("unreachable: sign-in failed");

	return { subjectId: created.subjectId, sessionId: signedIn.sessionId };
}

/** Registers a confidential client carrying the device grant, ready to poll with, granting the tenant's own device_grant feature first. */
async function createDeviceClient(
	overrides: { grantTypes?: string[]; scopes?: string[] } = {},
): Promise<{ clientId: string; clientSecret: string }> {
	await tenant.applyEntitlements({
		plan: "pro",
		features: { device_grant: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});

	let result = await tenant.registerClient({
		name: "Living Room TV",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: overrides.grantTypes ?? [DEVICE_GRANT_TYPE],
		responseTypes: [],
		scopes: overrides.scopes ?? ["openid", "profile", "offline_access"],
		tokenEndpointAuthMethod: "client_secret_post",
		requireConsent: false,
	});
	if (!result.ok || !result.secret) throw new Error("unreachable: client registration failed");
	return { clientId: result.client.id, clientSecret: result.secret };
}

/** Hashes a device code the same way the mechanism itself does, for a fixture row's own digest. */
async function hashDeviceCode(code: string): Promise<string> {
	let hashed = await sha256(code);
	if (isFailure(hashed)) throw new Error("unreachable: hashing failed in a test");
	return Hex.encode(hashed.data);
}

/** Writes a `device_authorizations` row directly, for a decision state no RPC can produce yet. */
function insertDeviceAuthorizationRow(row: {
	id: string;
	deviceCodeHash: string;
	clientId: string;
	scopes: string[];
	expiresAt: number;
	deniedAt?: number | null;
	createdAt: number;
}): void {
	state.storage.sql.exec(
		`INSERT INTO device_authorizations
			(id, device_code_hash, user_code, client_id, scopes, interval_s, last_polled_at,
			 expires_at, approved_at, denied_at, redeemed_at, subject_id, session_id, auth_time,
			 amr, token_family_id, created_at)
		 VALUES (?, ?, 'BCDFGHJK', ?, ?, 5, NULL, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
		row.id,
		row.deviceCodeHash,
		row.clientId,
		JSON.stringify(row.scopes),
		row.expiresAt,
		row.deniedAt ?? null,
		row.createdAt,
	);
}

/** Approves a minted row directly, the way `decideDeviceApproval` will once it exists. */
function approveDeviceAuthorizationRow(
	deviceCodeHash: string,
	fields: { subjectId: string; sessionId: string; authTime: number; amr: string[] },
): void {
	state.storage.sql.exec(
		`UPDATE device_authorizations
		 SET approved_at = ?, subject_id = ?, session_id = ?, auth_time = ?, amr = ?
		 WHERE device_code_hash = ?`,
		fields.authTime,
		fields.subjectId,
		fields.sessionId,
		fields.authTime,
		JSON.stringify(fields.amr),
		deviceCodeHash,
	);
}

/** Reads a signed JWT's claims back out without verifying it, for assertions only. */
function decodeClaims(token: string): Record<string, unknown> {
	let payload = token.split(".")[1] ?? "";
	let json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
	return JSON.parse(json) as Record<string, unknown>;
}

describe("beginDeviceAuthorization", () => {
	test("mints a well-formed response for a client carrying the grant", async () => {
		let { clientId } = await createDeviceClient();
		let now = Date.now();

		let result = await tenant.beginDeviceAuthorization({ clientId, scope: "openid profile", now });

		expect(result).toMatchObject({
			ok: true,
			verificationUri: `${ISSUER}/device`,
			expiresIn: 600,
			interval: 5,
		});
		if (!result.ok) throw new Error("unreachable");

		expect(result.deviceCode).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(result.userCode).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
		expect(result.verificationUriComplete).toBe(
			`${ISSUER}/device?user_code=${encodeURIComponent(result.userCode)}`,
		);
	});

	test("refuses a client that does not carry the device grant", async () => {
		let { clientId } = await createDeviceClient({ grantTypes: ["authorization_code"] });

		let result = await tenant.beginDeviceAuthorization({ clientId, scope: "", now: Date.now() });

		expect(result).toMatchObject({ ok: false, reason: "unsupported-grant-type" });
	});

	test("refuses a client id that does not resolve", async () => {
		let result = await tenant.beginDeviceAuthorization({
			clientId: "client_missing",
			scope: "",
			now: Date.now(),
		});

		expect(result).toMatchObject({ ok: false, reason: "invalid-client" });
	});

	test("refuses a scope outside the client's own ceiling", async () => {
		let { clientId } = await createDeviceClient({ scopes: ["openid"] });

		let result = await tenant.beginDeviceAuthorization({
			clientId,
			scope: "openid profile",
			now: Date.now(),
		});

		expect(result).toMatchObject({ ok: false, reason: "invalid-scope" });
	});

	test("the minted user code carries no vowel and no digit", async () => {
		let { clientId } = await createDeviceClient();

		let result = await tenant.beginDeviceAuthorization({ clientId, scope: "", now: Date.now() });
		if (!result.ok) throw new Error("unreachable");

		let folded = result.userCode.replace("-", "");
		expect(folded).toHaveLength(8);
		expect(folded).not.toMatch(/[AEIOU]/i);
		expect(folded).not.toMatch(/[0-9]/);
	});
});

describe("redeemDeviceCode", () => {
	test("answers authorization_pending before any decision", async () => {
		let { clientId, clientSecret } = await createDeviceClient();
		let now = Date.now();
		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid", now });
		if (!begun.ok) throw new Error("unreachable");

		let redeemed = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 1000,
		});

		expect(redeemed).toMatchObject({ kind: "error", error: "authorization_pending" });
	});

	test("answers slow_down on a too-soon poll, and the third poll respects the raised interval", async () => {
		let { clientId, clientSecret } = await createDeviceClient();
		let now = Date.now();
		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid", now });
		if (!begun.ok) throw new Error("unreachable");

		let first = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 1000,
		});
		expect(first).toMatchObject({ kind: "error", error: "authorization_pending" });

		// One second after the first poll: inside the still-default five-second interval.
		let second = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 2000,
		});
		expect(second).toMatchObject({ kind: "error", error: "slow_down" });

		// Seven seconds after the second poll: past the original five-second interval, but
		// inside the ten seconds `slow_down` just raised it to — this is `slow_down` only if
		// the raised interval, not the original one, is what governs the next poll.
		let third = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 9000,
		});
		expect(third).toMatchObject({ kind: "error", error: "slow_down" });
	});

	test("answers access_denied for a denied row", async () => {
		let { clientId, clientSecret } = await createDeviceClient();
		let now = Date.now();
		let deviceCode = randomToken({ bytes: 32 });

		insertDeviceAuthorizationRow({
			id: "devr_test_denied",
			deviceCodeHash: await hashDeviceCode(deviceCode),
			clientId,
			scopes: ["openid"],
			expiresAt: now + 600_000,
			deniedAt: now,
			createdAt: now,
		});

		let redeemed = await tenant.redeemDeviceCode({
			deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 1000,
		});

		expect(redeemed).toMatchObject({ kind: "error", error: "access_denied" });
	});

	test("answers expired_token for a row past its expiry", async () => {
		let { clientId, clientSecret } = await createDeviceClient();
		let now = Date.now();
		let deviceCode = randomToken({ bytes: 32 });

		insertDeviceAuthorizationRow({
			id: "devr_test_expired",
			deviceCodeHash: await hashDeviceCode(deviceCode),
			clientId,
			scopes: ["openid"],
			expiresAt: now - 1000,
			createdAt: now - 700_000,
		});

		let redeemed = await tenant.redeemDeviceCode({
			deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now,
		});

		expect(redeemed).toMatchObject({ kind: "error", error: "expired_token" });
	});

	test("redeems an approved row once, minting tokens carrying its own recorded subject and amr, and refuses a replay", async () => {
		let { clientId, clientSecret } = await createDeviceClient({
			scopes: ["openid", "profile", "offline_access"],
		});
		let now = Date.now();
		let begun = await tenant.beginDeviceAuthorization({
			clientId,
			scope: "openid offline_access",
			now,
		});
		if (!begun.ok) throw new Error("unreachable");

		let deviceCodeHash = await hashDeviceCode(begun.deviceCode);
		approveDeviceAuthorizationRow(deviceCodeHash, {
			subjectId: "sub_test_1",
			sessionId: "ses_test_1",
			authTime: now,
			amr: ["pwd"],
		});

		let redeemed = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 1000,
		});

		expect(redeemed.kind).toBe("tokens");
		if (redeemed.kind !== "tokens") throw new Error("unreachable");
		expect(redeemed.refreshToken).not.toBeNull();

		let idClaims = decodeClaims(redeemed.idToken ?? "");
		expect(idClaims.sub).toBe("sub_test_1");
		expect(idClaims.sid).toBe("ses_test_1");
		expect(idClaims.amr).toEqual(["pwd"]);

		let replay = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 2000,
		});

		expect(replay).toMatchObject({ kind: "error", error: "invalid_grant" });
	});

	test("closes the redemption race: two simultaneous redemptions of the same approved row, exactly one succeeds", async () => {
		let { clientId, clientSecret } = await createDeviceClient();
		let now = Date.now();
		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid", now });
		if (!begun.ok) throw new Error("unreachable");

		let deviceCodeHash = await hashDeviceCode(begun.deviceCode);
		approveDeviceAuthorizationRow(deviceCodeHash, {
			subjectId: "sub_test_2",
			sessionId: "ses_test_2",
			authTime: now,
			amr: [],
		});

		let [first, second] = await Promise.all([
			tenant.redeemDeviceCode({
				deviceCode: begun.deviceCode,
				clientId,
				clientSecret,
				authScheme: "post",
				now: now + 1000,
			}),
			tenant.redeemDeviceCode({
				deviceCode: begun.deviceCode,
				clientId,
				clientSecret,
				authScheme: "post",
				now: now + 1000,
			}),
		]);

		let outcomes = [first.kind, second.kind].sort();
		expect(outcomes).toEqual(["error", "tokens"]);
	});
});

describe("beginDeviceApproval", () => {
	test("refuses a code that matches no pending row", async () => {
		let { sessionId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);

		let result = await tenant.beginDeviceApproval({
			userCode: "ZZZZ-ZZZZ",
			sessionId,
			now: Date.now(),
		});

		expect(result).toMatchObject({ ok: false, reason: "unknown" });
	});

	test("refuses a code past its expiry", async () => {
		let { clientId } = await createDeviceClient();
		let { sessionId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);
		let now = Date.now();

		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid", now });
		if (!begun.ok) throw new Error("unreachable");

		let result = await tenant.beginDeviceApproval({
			userCode: begun.userCode,
			sessionId,
			now: now + 700_000,
		});

		expect(result).toMatchObject({ ok: false, reason: "expired" });
	});

	test("resolves a pending code to the right consent screen, accepting the code lower case and unhyphenated", async () => {
		let { clientId } = await createDeviceClient({ scopes: ["openid", "profile"] });
		let { sessionId, subjectId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);
		let now = Date.now();

		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid profile", now });
		if (!begun.ok) throw new Error("unreachable");

		let folded = begun.userCode.replace("-", "").toLowerCase();

		let result = await tenant.beginDeviceApproval({ userCode: folded, sessionId, now });

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.screen.client.id).toBe(clientId);
		expect(result.screen.subject.id).toBe(subjectId);
		expect(new Set(result.screen.requested.map((scope) => scope.scope))).toEqual(
			new Set(["openid", "profile"]),
		);
	});
});

describe("decideDeviceApproval", () => {
	test("refuses a device authorization id that does not resolve", async () => {
		let { sessionId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);

		let result = await tenant.decideDeviceApproval({
			deviceAuthorizationId: "devr_missing",
			sessionId,
			approved: true,
			now: Date.now(),
		});

		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("refuses a row that was already decided", async () => {
		let { clientId } = await createDeviceClient();
		let { sessionId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);
		let now = Date.now();

		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid", now });
		if (!begun.ok) throw new Error("unreachable");
		let approval = await tenant.beginDeviceApproval({ userCode: begun.userCode, sessionId, now });
		if (!approval.ok) throw new Error("unreachable");

		let first = await tenant.decideDeviceApproval({
			deviceAuthorizationId: approval.deviceAuthorizationId,
			sessionId,
			approved: true,
			now,
		});
		expect(first).toMatchObject({ ok: true, approved: true });

		let second = await tenant.decideDeviceApproval({
			deviceAuthorizationId: approval.deviceAuthorizationId,
			sessionId,
			approved: false,
			now,
		});
		expect(second).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("an approval unions the requested scopes into an existing grant rather than replacing it", async () => {
		let { clientId } = await createDeviceClient({ scopes: ["openid", "profile", "email"] });
		let { sessionId, subjectId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);
		let now = Date.now();

		// A standing grant for this same client already covers a different scope,
		// the way an earlier browser sign-in would have left one.
		await db.create(grants, {
			subject_id: subjectId,
			client_id: clientId,
			scopes: ["email"],
			created_at: now,
			updated_at: now,
		});

		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid profile", now });
		if (!begun.ok) throw new Error("unreachable");
		let approval = await tenant.beginDeviceApproval({ userCode: begun.userCode, sessionId, now });
		if (!approval.ok) throw new Error("unreachable");

		await tenant.decideDeviceApproval({
			deviceAuthorizationId: approval.deviceAuthorizationId,
			sessionId,
			approved: true,
			now,
		});

		let row = await db.find(grants, { subject_id: subjectId, client_id: clientId });
		expect(new Set(row?.scopes as string[])).toEqual(new Set(["email", "openid", "profile"]));
	});

	test("a denial marks the row denied, and a subsequent poll answers access_denied", async () => {
		let { clientId, clientSecret } = await createDeviceClient();
		let { sessionId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);
		let now = Date.now();

		let begun = await tenant.beginDeviceAuthorization({ clientId, scope: "openid", now });
		if (!begun.ok) throw new Error("unreachable");
		let approval = await tenant.beginDeviceApproval({ userCode: begun.userCode, sessionId, now });
		if (!approval.ok) throw new Error("unreachable");

		let decided = await tenant.decideDeviceApproval({
			deviceAuthorizationId: approval.deviceAuthorizationId,
			sessionId,
			approved: false,
			now,
		});
		expect(decided).toMatchObject({ ok: true, approved: false });

		let polled = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 1000,
		});
		expect(polled).toMatchObject({ kind: "error", error: "access_denied" });
	});

	test("a full approve-then-poll round trip through the real RPC surface mints real tokens", async () => {
		let { clientId, clientSecret } = await createDeviceClient({
			scopes: ["openid", "profile", "offline_access"],
		});
		let { sessionId, subjectId } = await createSignedInSubject(
			"jane@example.com",
			"correct horse battery staple",
		);
		let now = Date.now();

		let begun = await tenant.beginDeviceAuthorization({
			clientId,
			scope: "openid offline_access",
			now,
		});
		if (!begun.ok) throw new Error("unreachable");
		let approval = await tenant.beginDeviceApproval({ userCode: begun.userCode, sessionId, now });
		if (!approval.ok) throw new Error("unreachable");

		let decided = await tenant.decideDeviceApproval({
			deviceAuthorizationId: approval.deviceAuthorizationId,
			sessionId,
			approved: true,
			now,
		});
		expect(decided).toMatchObject({ ok: true, approved: true });

		let redeemed = await tenant.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: now + 1000,
		});

		expect(redeemed.kind).toBe("tokens");
		if (redeemed.kind !== "tokens") throw new Error("unreachable");
		expect(redeemed.refreshToken).not.toBeNull();

		let idClaims = decodeClaims(redeemed.idToken ?? "");
		expect(idClaims.sub).toBe(subjectId);
		expect(idClaims.sid).toBe(sessionId);
		expect(idClaims.amr).toEqual(["pwd"]);
	});
});
