/**
 * Drives `api-keys.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `clients.test.ts` and `sessions.test.ts` drive their own
 * modules: nothing here can wire a new RPC method onto the tenant object, so these
 * functions are exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { ApiKeyVerificationCache, CreateApiKeyInput } from "./api-keys";
import type { AuditActor } from "./audit-events";

import {
	apiKeys,
	authenticateApiKey,
	createApiKey,
	listApiKeys,
	revokeApiKey,
	rotateApiKey,
	setApiKeyPrefix,
	sweepExpiredApiKeys,
} from "./api-keys";
import { assignRole, definePermission, TENANT_SCOPE } from "./roles";
import { blockSubject, createSubject } from "./subjects";
import { runMigrations } from "./tenant-migrations";

/** A day, in milliseconds — mirrored from the module for readable test math. */
const DAY_MS = 24 * 60 * 60 * 1000;

let db: Database;

let ACTOR: AuditActor = { type: "platform", id: "system" };

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	db = new Database(driver);
});

/** Creates a subject with no identifiers, for tests that only need an id to key off. */
async function createTestSubject(): Promise<string> {
	let created = await createSubject(db, {});
	if (!created.ok) throw new Error("setup failed");
	return created.subjectId;
}

/**
 * Grants a subject the `owner` system role at the tenant scope, and declares the
 * given permission keys — an `owner` holds every declared permission, so this is
 * the shortest path to a subject with a real, checkable scope ceiling.
 */
async function grantHeldScopes(subjectId: string, scopes: string[]): Promise<void> {
	for (let scope of scopes) {
		await definePermission(db, { key: scope, name: scope, description: scope, actor: ACTOR });
	}

	let assigned = await assignRole(db, {
		subjectId,
		scope: TENANT_SCOPE,
		roleKey: "owner",
		actor: ACTOR,
	});
	if (!assigned.ok) throw new Error("setup failed");
}

/** Sets this database's key prefix, throwing if the call was refused. */
async function setPrefix(prefix = "acme"): Promise<string> {
	let result = await setApiKeyPrefix(db, { prefix, actor: ACTOR });
	if (!result.ok) throw new Error("setup failed");
	return result.prefix;
}

/** Mints a ready-to-use key for a subject already holding every requested scope. */
async function mintKeyFor(
	overrides: Partial<CreateApiKeyInput> & { subjectId: string },
): Promise<{ value: string; keyId: string }> {
	let created = await createApiKey(db, {
		name: "Test key",
		scopes: [],
		actor: ACTOR,
		...overrides,
	});
	if (!created.ok) throw new Error("setup failed");
	return { value: created.value, keyId: created.key.id };
}

describe("setApiKeyPrefix", () => {
	test("sets the prefix the first time it is called", async () => {
		let result = await setApiKeyPrefix(db, { prefix: "acme", actor: ACTOR });
		expect(result).toEqual({ ok: true, prefix: "acme" });
	});

	test("refuses a prefix shorter than two characters, longer than twelve, or holding anything but lowercase letters", async () => {
		expect(await setApiKeyPrefix(db, { prefix: "a", actor: ACTOR })).toEqual({
			ok: false,
			reason: "invalid-prefix",
		});
		expect(await setApiKeyPrefix(db, { prefix: "a".repeat(13), actor: ACTOR })).toEqual({
			ok: false,
			reason: "invalid-prefix",
		});
		expect(await setApiKeyPrefix(db, { prefix: "Acme", actor: ACTOR })).toEqual({
			ok: false,
			reason: "invalid-prefix",
		});
		expect(await setApiKeyPrefix(db, { prefix: "acme1", actor: ACTOR })).toEqual({
			ok: false,
			reason: "invalid-prefix",
		});
	});

	test("is a no-op success when called again with the identical value already stored", async () => {
		await setPrefix("acme");
		let result = await setApiKeyPrefix(db, { prefix: "acme", actor: ACTOR });
		expect(result).toEqual({ ok: true, prefix: "acme" });
	});

	test("refuses a call naming a different prefix than the one already stored", async () => {
		await setPrefix("acme");
		let result = await setApiKeyPrefix(db, { prefix: "other", actor: ACTOR });
		expect(result).toEqual({ ok: false, reason: "already-set", prefix: "acme" });
	});
});

describe("createApiKey", () => {
	test("refuses to mint before this tenant's own prefix has been set", async () => {
		let subjectId = await createTestSubject();

		let result = await createApiKey(db, { subjectId, name: "CI key", scopes: [], actor: ACTOR });
		expect(result).toEqual({ ok: false, reason: "prefix-not-set" });
	});

	test("mints a key whose scopes the subject holds, returning the record and the one-time value", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		await grantHeldScopes(subjectId, ["keys.read"]);

		let result = await createApiKey(db, {
			subjectId,
			name: "CI key",
			scopes: ["keys.read"],
			actor: ACTOR,
		});
		if (!result.ok) throw new Error("unreachable");

		expect(result.key).toMatchObject({
			subjectId,
			name: "CI key",
			scopes: ["keys.read"],
			revokedAt: null,
			lastUsedAt: null,
		});
		expect(result.key.hint).toBe(result.value.slice(-4));
		expect(result.value.startsWith("acme_")).toBe(true);

		let row = await db.find(apiKeys, { id: result.key.id });
		expect(row?.secret_hash).not.toBe(result.value);
	});

	test("refuses a scope the subject does not hold, naming which one", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		await grantHeldScopes(subjectId, ["keys.read"]);

		let result = await createApiKey(db, {
			subjectId,
			name: "CI key",
			scopes: ["keys.read", "keys.delete"],
			actor: ACTOR,
		});
		expect(result).toEqual({ ok: false, reason: "scope-not-held", scope: "keys.delete" });
	});

	test("defaults to a 90-day expiry when none is given", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let now = Date.now();

		let result = await createApiKey(db, {
			subjectId,
			name: "CI key",
			scopes: [],
			actor: ACTOR,
			at: now,
		});
		if (!result.ok) throw new Error("unreachable");

		expect(result.key.expiresAt).toBe(now + 90 * DAY_MS);
	});

	test("refuses an expiry more than 365 days out", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let now = Date.now();

		let result = await createApiKey(db, {
			subjectId,
			name: "CI key",
			scopes: [],
			actor: ACTOR,
			at: now,
			expiresAt: now + 366 * DAY_MS,
		});
		expect(result).toEqual({ ok: false, reason: "expiry-too-far" });
	});
});

describe("authenticateApiKey", () => {
	test("round-trips a freshly minted key's full value back to its subject and scopes", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		await grantHeldScopes(subjectId, ["keys.read"]);
		let { value, keyId } = await mintKeyFor({ subjectId, scopes: ["keys.read"] });

		let result = await authenticateApiKey(db, { presented: value });
		expect(result).toEqual({
			ok: true,
			keyId,
			subjectId,
			scopes: ["keys.read"],
			expiresAt: expect.any(Number),
		});
	});

	test("refuses a value that is not shaped like a key at all", async () => {
		expect(await authenticateApiKey(db, { presented: "not-a-key" })).toEqual({
			ok: false,
			reason: "malformed",
		});
		expect(await authenticateApiKey(db, { presented: "acme_tooshort_secret" })).toEqual({
			ok: false,
			reason: "malformed",
		});
	});

	test("refuses an unknown key with the same answer a wrong secret gets", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { value } = await mintKeyFor({ subjectId });

		let tampered = value.slice(0, -1) + (value.endsWith("a") ? "b" : "a");
		expect(await authenticateApiKey(db, { presented: tampered })).toEqual({
			ok: false,
			reason: "not-found",
		});
	});

	test("refuses an expired key", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let now = Date.now();
		let { value } = await mintKeyFor({ subjectId, at: now, expiresAt: now + 1000 });

		let result = await authenticateApiKey(db, { presented: value, now: now + 2000 });
		expect(result).toEqual({ ok: false, reason: "expired" });
	});

	test("refuses a revoked key", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { value, keyId } = await mintKeyFor({ subjectId });

		await revokeApiKey(db, { keyId, reason: "no longer needed", actor: ACTOR });

		expect(await authenticateApiKey(db, { presented: value })).toEqual({
			ok: false,
			reason: "revoked",
		});
	});

	test("refuses a blocked subject's key", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { value } = await mintKeyFor({ subjectId });

		await blockSubject(db, { subjectId, reason: "fraud" });

		expect(await authenticateApiKey(db, { presented: value })).toEqual({
			ok: false,
			reason: "subject-blocked",
		});
	});

	test("stamps last_used_at at most once a minute", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { value, keyId } = await mintKeyFor({ subjectId });
		let start = Date.now();

		await authenticateApiKey(db, { presented: value, now: start });
		let first = await db.find(apiKeys, { id: keyId });
		expect(first?.last_used_at).toBe(start);

		// Well inside the throttle window: the stamp does not move.
		await authenticateApiKey(db, { presented: value, now: start + 30_000 });
		let second = await db.find(apiKeys, { id: keyId });
		expect(second?.last_used_at).toBe(start);

		// Past the throttle window: the stamp moves to the new call.
		await authenticateApiKey(db, { presented: value, now: start + 61_000 });
		let third = await db.find(apiKeys, { id: keyId });
		expect(third?.last_used_at).toBe(start + 61_000);
	});

	test("a warm cache answers with no storage read: a row deleted after the first call still verifies", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { value, keyId } = await mintKeyFor({ subjectId });
		let cache: ApiKeyVerificationCache = new Map();

		let first = await authenticateApiKey(db, { presented: value }, cache);
		expect(first).toMatchObject({ ok: true, subjectId });
		expect(cache.has(keyId)).toBe(true);

		await db.delete(apiKeys, { id: keyId });

		let second = await authenticateApiKey(db, { presented: value }, cache);
		expect(second).toMatchObject({ ok: true, subjectId });
	});
});

describe("rotateApiKey", () => {
	test("mints a successor and opens the incumbent's default seven-day overlap", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { keyId } = await mintKeyFor({ subjectId });
		let now = Date.now();

		let result = await rotateApiKey(db, { keyId, actor: ACTOR, at: now });
		if (!result.ok) throw new Error("unreachable");

		expect(result.incumbentExpiresAt).toBe(now + 7 * DAY_MS);
		expect(result.key.id).not.toBe(keyId);
		expect(result.value.startsWith("acme_")).toBe(true);

		let incumbent = await db.find(apiKeys, { id: keyId });
		expect(incumbent?.expires_at).toBe(now + 7 * DAY_MS);
	});

	test("clamps an overlap under seven days up to seven", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { keyId } = await mintKeyFor({ subjectId });
		let now = Date.now();

		let result = await rotateApiKey(db, { keyId, overlap: 1, actor: ACTOR, at: now });
		if (!result.ok) throw new Error("unreachable");

		expect(result.incumbentExpiresAt).toBe(now + 7 * DAY_MS);
	});

	test("refuses an overlap past thirty days", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { keyId } = await mintKeyFor({ subjectId });

		let result = await rotateApiKey(db, { keyId, overlap: 31, actor: ACTOR });
		expect(result).toEqual({ ok: false, reason: "overlap-too-long" });
	});

	test("updates the instance's own verification cache for the incumbent in the same call", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { value, keyId } = await mintKeyFor({ subjectId });
		let cache: ApiKeyVerificationCache = new Map();

		await authenticateApiKey(db, { presented: value }, cache);
		expect(cache.get(keyId)?.expiresAt).not.toBe(undefined);

		let now = Date.now();
		let rotated = await rotateApiKey(db, { keyId, actor: ACTOR, at: now }, cache);
		if (!rotated.ok) throw new Error("unreachable");

		expect(cache.get(keyId)?.expiresAt).toBe(now + 7 * DAY_MS);
	});
});

describe("revokeApiKey", () => {
	test("revokes a key at once", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { keyId } = await mintKeyFor({ subjectId });
		let now = Date.now();

		let result = await revokeApiKey(db, { keyId, reason: "compromised", actor: ACTOR, at: now });
		expect(result).toEqual({ ok: true });

		let row = await db.find(apiKeys, { id: keyId });
		expect(row).toMatchObject({ revoked_at: now, revoked_reason: "compromised" });
	});

	test("refuses a key that does not exist", async () => {
		let result = await revokeApiKey(db, {
			keyId: "akey_does_not_exist",
			reason: "n/a",
			actor: ACTOR,
		});
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("evicts the key from the instance's own verification cache in the same call", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let { value, keyId } = await mintKeyFor({ subjectId });
		let cache: ApiKeyVerificationCache = new Map();

		await authenticateApiKey(db, { presented: value }, cache);
		expect(cache.has(keyId)).toBe(true);

		await revokeApiKey(db, { keyId, reason: "compromised", actor: ACTOR }, cache);
		expect(cache.has(keyId)).toBe(false);
	});
});

describe("listApiKeys", () => {
	test("never projects the stored secret hash", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		await mintKeyFor({ subjectId });

		let result = await listApiKeys(db, { subjectId });
		if (!result.ok) throw new Error("unreachable");

		expect(result.keys).toHaveLength(1);
		expect(result.keys[0]).not.toHaveProperty("secretHash");
	});
});

describe("sweepExpiredApiKeys", () => {
	test("deletes keys past their expiry, bounded by limit", async () => {
		await setPrefix("acme");
		let subjectId = await createTestSubject();
		let now = Date.now();

		for (let index = 0; index < 3; index++) {
			await mintKeyFor({ subjectId, at: now, expiresAt: now + 1000 });
		}

		let first = await sweepExpiredApiKeys(db, { before: now + 2000, limit: 2 });
		expect(first).toEqual({ deleted: 2, more: true });

		let second = await sweepExpiredApiKeys(db, { before: now + 2000, limit: 2 });
		expect(second).toEqual({ deleted: 1, more: false });
	});
});
