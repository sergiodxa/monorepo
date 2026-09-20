/**
 * Drives `clients.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `sessions.test.ts` and `passkeys.test.ts` drive their own
 * modules: nothing here can wire a new RPC method onto the tenant object, so these
 * functions are exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scryptSync } from "node:crypto";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64Url, randomBytes } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { RegisterClientInput } from "./clients";

import { readAuditPage } from "./audit-events";
import {
	clientSecrets,
	clients,
	deleteClient,
	disableClient,
	listClients,
	redirectUriMatches,
	registerClient,
	revokeClientSecret,
	rotateClientSecret,
	sweepExpiredClientSecrets,
	updateClient,
	validateRedirectUri,
	verifyClientSecret,
} from "./clients";
import { runMigrations } from "./tenant-migrations";
import clientsMigration from "./tenant-migrations/0007-clients.sql?raw";

/** A rotation's default overlap window, in milliseconds, mirrored from the module. */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	await driver.executeScript(clientsMigration);
	db = new Database(driver);
});

afterEach(() => {
	vi.useRealTimers();
});

/** The record `registerClient` accepts when a test does not care about most of it. */
function baseInput(overrides: Partial<RegisterClientInput> = {}): RegisterClientInput {
	return {
		name: "Test Client",
		kind: "confidential",
		redirectUris: ["https://example.com/callback"],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["openid"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
		...overrides,
	};
}

/** Registers a client, throwing if the record was refused, for tests that need one already made. */
async function createTestClient(overrides: Partial<RegisterClientInput> = {}) {
	let result = await registerClient(db, baseInput(overrides));
	if (!result.ok) throw new Error("unreachable");
	return result;
}

describe("validateRedirectUri", () => {
	test("accepts an https URI", () => {
		expect(validateRedirectUri("https://example.com/callback")).toEqual({ ok: true });
	});

	test("accepts http on the loopback IPv4 address", () => {
		expect(validateRedirectUri("http://127.0.0.1:51000/callback")).toEqual({ ok: true });
	});

	test("accepts http on localhost", () => {
		expect(validateRedirectUri("http://localhost:51000/callback")).toEqual({ ok: true });
	});

	test("accepts http on the loopback IPv6 address", () => {
		expect(validateRedirectUri("http://[::1]:51000/callback")).toEqual({ ok: true });
	});

	test("rejects http on a non-loopback host", () => {
		expect(validateRedirectUri("http://example.com/callback")).toEqual({
			ok: false,
			reason: "insecure-scheme",
		});
	});

	test("accepts a custom scheme, for a native app's own", () => {
		expect(validateRedirectUri("com.example.app:/callback")).toEqual({ ok: true });
	});

	test("rejects a URI with a fragment", () => {
		expect(validateRedirectUri("https://example.com/callback#frag")).toEqual({
			ok: false,
			reason: "has-fragment",
		});
	});

	test("rejects a relative URI", () => {
		expect(validateRedirectUri("/callback")).toEqual({ ok: false, reason: "not-absolute" });
	});
});

describe("redirectUriMatches", () => {
	test("matches identical URIs", () => {
		expect(redirectUriMatches("https://example.com/cb", "https://example.com/cb")).toBe(true);
	});

	test("matches loopback IPv4 URIs that differ only in port", () => {
		expect(redirectUriMatches("http://127.0.0.1:4000/cb", "http://127.0.0.1:53219/cb")).toBe(true);
	});

	test("matches loopback localhost URIs that differ only in port", () => {
		expect(redirectUriMatches("http://localhost:4000/cb", "http://localhost:53219/cb")).toBe(true);
	});

	test("matches loopback IPv6 URIs that differ only in port", () => {
		expect(redirectUriMatches("http://[::1]:4000/cb", "http://[::1]:53219/cb")).toBe(true);
	});

	test("refuses a different path even on loopback", () => {
		expect(redirectUriMatches("http://127.0.0.1:4000/cb", "http://127.0.0.1:4000/other")).toBe(
			false,
		);
	});

	test("refuses a different port on a non-loopback host", () => {
		expect(redirectUriMatches("https://example.com:4000/cb", "https://example.com:9999/cb")).toBe(
			false,
		);
	});

	test("refuses a different scheme even on the same loopback host and port", () => {
		expect(redirectUriMatches("http://127.0.0.1:4000/cb", "https://127.0.0.1:4000/cb")).toBe(false);
	});
});

describe("registerClient", () => {
	test("mints exactly one secret for a confidential client", async () => {
		let result = await createTestClient();

		expect(result.secret).toMatch(/^csec_/);
		expect(result.client.kind).toBe("confidential");

		let rows = await db.findMany(clientSecrets, { where: { client_id: result.client.id } });
		expect(rows).toHaveLength(1);
		expect(rows[0]?.hash).not.toBe(result.secret);
	});

	test("mints no secret for a public client", async () => {
		let result = await createTestClient({
			kind: "public",
			tokenEndpointAuthMethod: "none",
		});

		expect(result.secret).toBeNull();

		let rows = await db.findMany(clientSecrets, { where: { client_id: result.client.id } });
		expect(rows).toHaveLength(0);
	});

	test("refuses client_secret_basic for a public client", async () => {
		let result = await registerClient(
			db,
			baseInput({ kind: "public", tokenEndpointAuthMethod: "client_secret_basic" }),
		);

		expect(result).toEqual({
			ok: false,
			reason: "invalid-auth-method",
			method: "client_secret_basic",
			kind: "public",
		});
	});

	test("refuses none for a confidential client", async () => {
		let result = await registerClient(
			db,
			baseInput({ kind: "confidential", tokenEndpointAuthMethod: "none" }),
		);

		expect(result).toEqual({
			ok: false,
			reason: "invalid-auth-method",
			method: "none",
			kind: "confidential",
		});
	});

	test("refuses an invalid redirect URI", async () => {
		let result = await registerClient(
			db,
			baseInput({ redirectUris: ["https://example.com/callback#frag"] }),
		);

		expect(result).toEqual({
			ok: false,
			reason: "invalid-redirect-uri",
			uri: "https://example.com/callback#frag",
			detail: "has-fragment",
		});
	});

	test("refuses an unknown grant type", async () => {
		let result = await registerClient(db, baseInput({ grantTypes: ["not-a-real-grant"] }));

		expect(result).toEqual({ ok: false, reason: "invalid-grant-type", value: "not-a-real-grant" });
	});
});

describe("updateClient", () => {
	test("replaces the whole editable record in one call", async () => {
		let created = await createTestClient();

		let updated = await updateClient(db, {
			clientId: created.client.id,
			name: "Renamed Client",
			kind: "confidential",
			redirectUris: ["https://example.com/new-callback"],
			postLogoutRedirectUris: ["https://example.com/logged-out"],
			grantTypes: ["authorization_code", "refresh_token"],
			responseTypes: ["code"],
			scopes: ["openid", "profile"],
			tokenEndpointAuthMethod: "client_secret_post",
			requireConsent: true,
		});

		expect(updated).toEqual({
			ok: true,
			client: {
				id: created.client.id,
				name: "Renamed Client",
				kind: "confidential",
				redirectUris: ["https://example.com/new-callback"],
				postLogoutRedirectUris: ["https://example.com/logged-out"],
				grantTypes: ["authorization_code", "refresh_token"],
				responseTypes: ["code"],
				scopes: ["openid", "profile"],
				tokenEndpointAuthMethod: "client_secret_post",
				requireConsent: true,
				createdAt: created.client.createdAt,
				updatedAt: expect.any(Number),
				disabledAt: null,
			},
		});
	});

	test("refuses a change to kind", async () => {
		let created = await createTestClient();

		let updated = await updateClient(db, {
			...baseInput(),
			clientId: created.client.id,
			kind: "public",
		});

		expect(updated).toEqual({ ok: false, reason: "kind-immutable" });
	});

	test("refuses an update for a client that does not exist", async () => {
		let updated = await updateClient(db, { ...baseInput(), clientId: "client_missing" });

		expect(updated).toEqual({ ok: false, reason: "not-found" });
	});
});

describe("rotateClientSecret, revokeClientSecret and sweepExpiredClientSecrets", () => {
	test("rotates, sweeps nothing yet, then removes the incumbent once its window closes", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);

		let created = await createTestClient();
		let firstSecret = (
			await db.findMany(clientSecrets, { where: { client_id: created.client.id } })
		)[0];
		if (!firstSecret) throw new Error("unreachable");
		let firstSecretId = firstSecret.id;

		let rotated = await rotateClientSecret(db, { clientId: created.client.id });
		if (!rotated.ok) throw new Error("unreachable");

		expect(rotated.secret).toMatch(/^csec_/);
		expect(rotated.incumbentExpiresAt).toBe(1_700_000_000_000 + SEVEN_DAYS_MS);

		let live = await db.findMany(clientSecrets, { where: { client_id: created.client.id } });
		expect(live).toHaveLength(2);

		let tooEarly = await sweepExpiredClientSecrets(db);
		expect(tooEarly).toEqual({ deleted: 0, more: false });
		expect(await db.find(clientSecrets, { id: firstSecretId })).not.toBeNull();

		vi.setSystemTime(1_700_000_000_000 + SEVEN_DAYS_MS + 1);

		let swept = await sweepExpiredClientSecrets(db);
		expect(swept).toEqual({ deleted: 1, more: false });
		expect(await db.find(clientSecrets, { id: firstSecretId })).toBeNull();
		expect(await db.find(clientSecrets, { id: rotated.secretId })).not.toBeNull();
	});

	test("refuses a third rotation while two secrets are already live", async () => {
		let created = await createTestClient();
		await rotateClientSecret(db, { clientId: created.client.id });

		let third = await rotateClientSecret(db, { clientId: created.client.id });

		expect(third).toEqual({ ok: false, reason: "too-many-live-secrets" });
	});

	test("refuses rotation for a public client", async () => {
		let created = await createTestClient({ kind: "public", tokenEndpointAuthMethod: "none" });

		let result = await rotateClientSecret(db, { clientId: created.client.id });

		expect(result).toEqual({ ok: false, reason: "not-confidential" });
	});

	test("caps a requested window at 30 days", async () => {
		let created = await createTestClient();
		let before = Date.now();

		let rotated = await rotateClientSecret(db, { clientId: created.client.id, windowDays: 90 });
		if (!rotated.ok) throw new Error("unreachable");

		expect(rotated.incumbentExpiresAt).toBeLessThanOrEqual(
			before + 30 * 24 * 60 * 60 * 1000 + 1000,
		);
	});

	test("refuses to revoke a confidential client's only live secret", async () => {
		let created = await createTestClient();
		let secretId = (
			await db.findMany(clientSecrets, { where: { client_id: created.client.id } })
		)[0]?.id;
		if (!secretId) throw new Error("unreachable");

		let result = await revokeClientSecret(db, { clientId: created.client.id, secretId });

		expect(result).toEqual({ ok: false, reason: "last-live-secret" });
	});

	test("revokes one of two live secrets, closing its window immediately", async () => {
		let created = await createTestClient();
		let original = (
			await db.findMany(clientSecrets, { where: { client_id: created.client.id } })
		)[0];
		if (!original) throw new Error("unreachable");

		let rotated = await rotateClientSecret(db, { clientId: created.client.id });
		if (!rotated.ok) throw new Error("unreachable");

		let now = Date.now();
		let revoked = await revokeClientSecret(db, {
			clientId: created.client.id,
			secretId: rotated.secretId,
		});

		expect(revoked).toEqual({ ok: true });

		let revokedRow = await db.find(clientSecrets, { id: rotated.secretId });
		expect(revokedRow?.expires_at).toBeGreaterThanOrEqual(now);
		expect(revokedRow?.expires_at).not.toBeNull();

		// The row is closed, not gone: the sweep is what removes it once its window passes.
		let sweptImmediately = await sweepExpiredClientSecrets(db, { now });
		expect(sweptImmediately.deleted).toBe(0);
		expect(await db.find(clientSecrets, { id: rotated.secretId })).not.toBeNull();
		expect(await db.find(clientSecrets, { id: original.id })).not.toBeNull();
	});
});

describe("disableClient", () => {
	test("marks a client disabled", async () => {
		let created = await createTestClient();

		let result = await disableClient(db, { clientId: created.client.id });
		expect(result).toEqual({ ok: true });

		let row = await db.find(clients, { id: created.client.id });
		expect(row?.disabled_at).not.toBeNull();
	});

	test("refuses a client that does not exist", async () => {
		expect(await disableClient(db, { clientId: "client_missing" })).toEqual({
			ok: false,
			reason: "not-found",
		});
	});
});

describe("deleteClient", () => {
	test("deletes the client and its secrets", async () => {
		let created = await createTestClient();

		let result = await deleteClient(db, { clientId: created.client.id });
		expect(result).toEqual({ ok: true });

		expect(await db.find(clients, { id: created.client.id })).toBeNull();
		expect(await db.findMany(clientSecrets, { where: { client_id: created.client.id } })).toEqual(
			[],
		);
	});

	test("refuses a client that does not exist", async () => {
		expect(await deleteClient(db, { clientId: "client_missing" })).toEqual({
			ok: false,
			reason: "not-found",
		});
	});
});

describe("listClients", () => {
	test("pages newest first", async () => {
		let first = await createTestClient({ name: "First" });
		await db.update(clients, { id: first.client.id }, { created_at: 1_000 });

		let second = await createTestClient({ name: "Second" });
		await db.update(clients, { id: second.client.id }, { created_at: 2_000 });

		let third = await createTestClient({ name: "Third" });
		await db.update(clients, { id: third.client.id }, { created_at: 3_000 });

		let page = await listClients(db, { limit: 2 });
		if (!page.ok) throw new Error("unreachable");

		expect(page.clients.map((client) => client.id)).toEqual([third.client.id, second.client.id]);
		expect(page.cursors.next).not.toBeNull();

		let next = await listClients(db, { cursor: page.cursors.next, limit: 2 });
		if (!next.ok) throw new Error("unreachable");

		expect(next.clients.map((client) => client.id)).toEqual([first.client.id]);
		expect(next.cursors.next).toBeNull();
	});

	test("answers bad-cursor for a cursor this ordering did not mint", async () => {
		await createTestClient();

		let page = await listClients(db, { cursor: "not-a-real-cursor" });

		expect(page).toEqual({ ok: false, reason: "bad-cursor" });
	});
});

describe("verifyClientSecret", () => {
	test("succeeds against either live secret", async () => {
		let created = await createTestClient();
		if (!created.secret) throw new Error("unreachable");

		let rotated = await rotateClientSecret(db, { clientId: created.client.id });
		if (!rotated.ok) throw new Error("unreachable");

		expect(
			await verifyClientSecret(db, { clientId: created.client.id, secret: created.secret }),
		).toEqual({
			ok: true,
		});
		expect(
			await verifyClientSecret(db, { clientId: created.client.id, secret: rotated.secret }),
		).toEqual({ ok: true });
	});

	test("fails when the secret matches nothing live", async () => {
		let created = await createTestClient();

		expect(
			await verifyClientSecret(db, { clientId: created.client.id, secret: "csec_not-the-secret" }),
		).toEqual({ ok: false });
	});

	test("rehashes a stored hash written under an older policy on a successful verify", async () => {
		let created = await createTestClient();
		if (!created.secret) throw new Error("unreachable");

		let row = (await db.findMany(clientSecrets, { where: { client_id: created.client.id } }))[0];
		if (!row) throw new Error("unreachable");

		let legacy = legacyHash(created.secret, 12);
		await db.update(clientSecrets, { id: row.id }, { hash: legacy });

		let result = await verifyClientSecret(db, {
			clientId: created.client.id,
			secret: created.secret,
		});
		expect(result).toEqual({ ok: true });

		let rehashed = await db.find(clientSecrets, { id: row.id });
		expect(rehashed?.hash).not.toBe(legacy);
		expect(rehashed?.hash).toMatch(/^\$scrypt\$ln=15,r=8,p=3\$/);
	});

	test("updates last_used_at on a successful verify", async () => {
		let created = await createTestClient();
		if (!created.secret) throw new Error("unreachable");

		await verifyClientSecret(db, { clientId: created.client.id, secret: created.secret });

		let row = (await db.findMany(clientSecrets, { where: { client_id: created.client.id } }))[0];
		expect(row?.last_used_at).not.toBeNull();
	});
});

describe("audit", () => {
	async function auditRowsFor(action: string) {
		let page = await readAuditPage(db, { from: 0, to: Date.now() + 60_000, action });
		if (!page.ok) throw new Error("unreachable");
		return page.events;
	}

	test("client.created lands when a client is registered", async () => {
		let created = await createTestClient();

		let rows = await auditRowsFor("client.created");
		expect(rows).toMatchObject([
			{ actorType: "platform", targetId: created.client.id, outcome: "succeeded" },
		]);
	});

	test("client.updated lands when a client's record is replaced", async () => {
		let created = await createTestClient();

		await updateClient(db, {
			clientId: created.client.id,
			...baseInput({ name: "Renamed Client" }),
		});

		let rows = await auditRowsFor("client.updated");
		expect(rows).toMatchObject([{ targetId: created.client.id, outcome: "succeeded" }]);
	});

	test("client.secret.rotated lands when a successor secret is minted", async () => {
		let created = await createTestClient();

		await rotateClientSecret(db, { clientId: created.client.id });

		let rows = await auditRowsFor("client.secret.rotated");
		expect(rows).toMatchObject([{ targetId: created.client.id, outcome: "succeeded" }]);
	});

	test("client.secret.revoked lands when a secret's window is closed", async () => {
		let created = await createTestClient();
		let rotated = await rotateClientSecret(db, { clientId: created.client.id });
		if (!rotated.ok) throw new Error("unreachable");

		await revokeClientSecret(db, { clientId: created.client.id, secretId: rotated.secretId });

		let rows = await auditRowsFor("client.secret.revoked");
		expect(rows).toMatchObject([
			{ targetId: created.client.id, detail: { secretId: rotated.secretId } },
		]);
	});

	test("client.disabled lands when a client is disabled", async () => {
		let created = await createTestClient();

		await disableClient(db, { clientId: created.client.id });

		let rows = await auditRowsFor("client.disabled");
		expect(rows).toMatchObject([{ targetId: created.client.id, outcome: "succeeded" }]);
	});

	test("client.deleted lands when a client is deleted", async () => {
		let created = await createTestClient();

		await deleteClient(db, { clientId: created.client.id });

		let rows = await auditRowsFor("client.deleted");
		expect(rows).toMatchObject([{ targetId: created.client.id, outcome: "succeeded" }]);
	});
});

/**
 * Builds an encoded scrypt hash with arbitrary cost parameters, standing in for a
 * value `client_secrets.hash` was written with under an older policy.
 */
function legacyHash(secret: string, logN: number): string {
	let salt = randomBytes(16);
	let key = scryptSync(secret, salt, 32, { N: 2 ** logN, r: 8, p: 1 });

	return `$scrypt$ln=${logN},r=8,p=1$${Base64Url.encode(salt)}$${Base64Url.encode(new Uint8Array(key))}`;
}
