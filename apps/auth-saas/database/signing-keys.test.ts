/**
 * Drives `signing-keys.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `sessions.test.ts` drives the tenant object's session
 * functions: nothing here can wire a new RPC method onto the tenant object, so these
 * functions are exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { readAuditPage } from "./audit-events";
import {
	advanceSigningKeys,
	customClaims,
	publishKeySet,
	setCustomClaims,
	signingKeys,
} from "./signing-keys";
import { runMigrations } from "./tenant-migrations";
import signingKeysMigration from "./tenant-migrations/0006-signing-keys.sql?raw";

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	await driver.executeScript(signingKeysMigration);
	db = new Database(driver);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("advanceSigningKeys", () => {
	test("generates the tenant's first key, staged and signing at once", async () => {
		let published = await advanceSigningKeys(db, { now: T0 });

		expect(published.keys).toHaveLength(1);
		expect(published.keys[0]).toMatchObject({ kty: "EC", alg: "ES256" });
		expect(published.keys[0]).not.toHaveProperty("d");

		let rows = await db.findMany(signingKeys);
		expect(rows).toEqual([
			expect.objectContaining({
				signing_from: T0,
				retired_at: null,
				publish_until: null,
			}),
		]);
	});

	test("does nothing further when nothing is due", async () => {
		await advanceSigningKeys(db, { now: T0 });
		let rows = await db.findMany(signingKeys);

		let published = await advanceSigningKeys(db, { now: T0 + 1000 });
		let rowsAfter = await db.findMany(signingKeys);

		expect(rowsAfter).toEqual(rows);
		expect(published.keys).toHaveLength(1);
	});

	test("stages a successor once the signing key's window has elapsed", async () => {
		await advanceSigningKeys(db, { now: T0 });

		let published = await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });

		let rows = await db.findMany(signingKeys);
		expect(rows).toHaveLength(2);

		let staged = rows.find((row) => row.signing_from === null);
		expect(staged).toMatchObject({ created_at: T0 + 90 * DAY_MS, retired_at: null });

		// The successor is published alongside the incumbent, ahead of ever signing.
		expect(published.keys).toHaveLength(2);
	});

	test("promotes a staged key once its staged window has elapsed, retiring the incumbent", async () => {
		await advanceSigningKeys(db, { now: T0 });
		await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });

		let promotedAt = T0 + 90 * DAY_MS + 24 * 60 * 60 * 1000;
		let published = await advanceSigningKeys(db, { now: promotedAt });

		let rows = await db.findMany(signingKeys);
		expect(rows).toHaveLength(2);

		let signing = rows.find((row) => row.retired_at === null);
		let retired = rows.find((row) => row.retired_at !== null);

		expect(signing).toMatchObject({ signing_from: promotedAt });
		expect(retired).toMatchObject({
			retired_at: promotedAt,
			publish_until: promotedAt + 7 * DAY_MS,
		});

		// Both the freshly promoted key and its retired predecessor stay published.
		expect(published.keys).toHaveLength(2);
	});

	test("writes a signing_key.rotated row when a staged key is promoted", async () => {
		await advanceSigningKeys(db, { now: T0 });
		await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });

		let promotedAt = T0 + 90 * DAY_MS + 24 * 60 * 60 * 1000;
		await advanceSigningKeys(db, { now: promotedAt });

		let rows = await db.findMany(signingKeys);
		let signing = rows.find((row) => row.retired_at === null);
		let retired = rows.find((row) => row.retired_at !== null);

		let page = await readAuditPage(db, {
			from: 0,
			to: promotedAt + 60_000,
			action: "signing_key.rotated",
		});
		if (!page.ok) throw new Error("unreachable");

		expect(page.events).toMatchObject([
			{
				actorType: "platform",
				targetType: "signing_key",
				targetId: signing?.id,
				outcome: "succeeded",
				detail: { retiredKeyId: retired?.id },
			},
		]);
	});

	test("deletes a key once it is past its publish window", async () => {
		await advanceSigningKeys(db, { now: T0 });
		await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let promotedAt = T0 + 90 * DAY_MS + 24 * 60 * 60 * 1000;
		await advanceSigningKeys(db, { now: promotedAt });

		let published = await advanceSigningKeys(db, { now: promotedAt + 7 * DAY_MS });

		let rows = await db.findMany(signingKeys);
		expect(rows).toHaveLength(1);
		expect(published.keys).toHaveLength(1);
	});

	test("calling it twice at the same instant changes nothing the second time", async () => {
		await advanceSigningKeys(db, { now: T0 });
		await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });

		let first = await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let rows = await db.findMany(signingKeys);

		let second = await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let rowsAfter = await db.findMany(signingKeys);

		expect(second).toEqual(first);
		expect(rowsAfter).toEqual(rows);
	});
});

describe("publishKeySet", () => {
	test("matches what advanceSigningKeys last published, without performing a transition", async () => {
		let advanced = await advanceSigningKeys(db, { now: T0 });
		let rowsBefore = await db.findMany(signingKeys);

		let republished = await publishKeySet(db, { now: T0 + 1000 });
		let rowsAfter = await db.findMany(signingKeys);

		expect(republished).toEqual(advanced);
		expect(rowsAfter).toEqual(rowsBefore);
	});
});

describe("setCustomClaims", () => {
	function claim(overrides: Partial<Parameters<typeof setCustomClaims>[1]["claims"][number]> = {}) {
		return {
			name: "https://example.com/roles",
			attributeKey: "roles",
			placement: "id_token" as const,
			scope: "read:roles",
			...overrides,
		};
	}

	test("replaces the tenant's whole claim set in one write", async () => {
		let result = await setCustomClaims(db, {
			claims: [
				claim({ name: "https://example.com/roles", attributeKey: "roles" }),
				claim({ name: "urn:example:department", attributeKey: "department" }),
			],
		});

		expect(result).toEqual({ ok: true });

		let rows = await db.findMany(customClaims);
		expect(rows.map((row) => row.name).sort()).toEqual([
			"https://example.com/roles",
			"urn:example:department",
		]);

		let second = await setCustomClaims(db, { claims: [claim({ name: "urn:example:only" })] });
		expect(second).toEqual({ ok: true });

		let rowsAfter = await db.findMany(customClaims);
		expect(rowsAfter.map((row) => row.name)).toEqual(["urn:example:only"]);
	});

	test("refuses a name that is not namespaced as a URI", async () => {
		let result = await setCustomClaims(db, { claims: [claim({ name: "roles" })] });
		expect(result).toEqual({ ok: false, reason: "not-namespaced", name: "roles" });
	});

	test("refuses a name colliding with a registered claim", async () => {
		let result = await setCustomClaims(db, { claims: [claim({ name: "sub" })] });
		expect(result).toEqual({ ok: false, reason: "reserved-name", name: "sub" });
	});

	test("refuses a name colliding with a claim this design mints", async () => {
		let result = await setCustomClaims(db, { claims: [claim({ name: "email" })] });
		expect(result).toEqual({ ok: false, reason: "reserved-name", name: "email" });
	});

	test("refuses a duplicate name within the same call", async () => {
		let result = await setCustomClaims(db, {
			claims: [claim({ name: "urn:example:role" }), claim({ name: "urn:example:role" })],
		});

		expect(result).toEqual({ ok: false, reason: "duplicate-name", name: "urn:example:role" });
	});

	test("refuses more than sixteen claims", async () => {
		let claims = Array.from({ length: 17 }, (_, i) => claim({ name: `urn:example:claim-${i}` }));

		let result = await setCustomClaims(db, { claims });
		expect(result).toEqual({ ok: false, reason: "too-many-claims" });
	});

	test("refuses a set whose payload exceeds four kilobytes", async () => {
		let claims = Array.from({ length: 16 }, (_, i) =>
			claim({ name: `https://example.com/${"x".repeat(300)}-${i}` }),
		);

		let result = await setCustomClaims(db, { claims });
		expect(result).toEqual({ ok: false, reason: "payload-too-large" });
	});
});
