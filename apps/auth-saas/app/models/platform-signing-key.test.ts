/**
 * Drives `platform-signing-key.ts` directly against the control-plane test database,
 * the same rotation/publication behavior `database/signing-keys.test.ts` covers for a
 * tenant's own keys, checked here for the platform's single, tenant-less identity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import { createTestDatabase } from "~/app/test/db";

import {
	advancePlatformSigningKeys,
	currentPlatformSigningKeyPair,
	ensurePlatformSigningKey,
	platformSigningKeys,
	publishPlatformKeySet,
} from "./platform-signing-key";

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

describe("advancePlatformSigningKeys", () => {
	test("generates the platform's first key, staged and signing at once", async () => {
		let published = await advancePlatformSigningKeys(db, { now: T0 });

		expect(published.keys).toHaveLength(1);
		expect(published.keys[0]).toMatchObject({ kty: "EC", alg: "ES256" });
		expect(published.keys[0]).not.toHaveProperty("d");

		let rows = await db.findMany(platformSigningKeys);
		expect(rows).toEqual([
			expect.objectContaining({ signing_from: T0, retired_at: null, publish_until: null }),
		]);
	});

	test("does nothing further when nothing is due", async () => {
		await advancePlatformSigningKeys(db, { now: T0 });
		let rows = await db.findMany(platformSigningKeys);

		let published = await advancePlatformSigningKeys(db, { now: T0 + 1000 });
		let rowsAfter = await db.findMany(platformSigningKeys);

		expect(rowsAfter).toEqual(rows);
		expect(published.keys).toHaveLength(1);
	});

	test("stages a successor once the signing key's window has elapsed", async () => {
		await advancePlatformSigningKeys(db, { now: T0 });

		let published = await advancePlatformSigningKeys(db, { now: T0 + 90 * DAY_MS });

		let rows = await db.findMany(platformSigningKeys);
		expect(rows).toHaveLength(2);

		let staged = rows.find((row) => row.signing_from === null);
		expect(staged).toMatchObject({ created_at: T0 + 90 * DAY_MS, retired_at: null });
		expect(published.keys).toHaveLength(2);
	});

	test("promotes a staged key once its staged window has elapsed, retiring the incumbent", async () => {
		await advancePlatformSigningKeys(db, { now: T0 });
		await advancePlatformSigningKeys(db, { now: T0 + 90 * DAY_MS });

		let promotedAt = T0 + 90 * DAY_MS + DAY_MS;
		let published = await advancePlatformSigningKeys(db, { now: promotedAt });

		let rows = await db.findMany(platformSigningKeys);
		expect(rows).toHaveLength(2);

		let signing = rows.find((row) => row.retired_at === null);
		let retired = rows.find((row) => row.retired_at !== null);

		expect(signing).toMatchObject({ signing_from: promotedAt });
		expect(retired).toMatchObject({
			retired_at: promotedAt,
			publish_until: promotedAt + 7 * DAY_MS,
		});
		expect(published.keys).toHaveLength(2);
	});

	test("deletes a key once it is past its publish window", async () => {
		await advancePlatformSigningKeys(db, { now: T0 });
		await advancePlatformSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let promotedAt = T0 + 90 * DAY_MS + DAY_MS;
		await advancePlatformSigningKeys(db, { now: promotedAt });

		let published = await advancePlatformSigningKeys(db, { now: promotedAt + 7 * DAY_MS });

		let rows = await db.findMany(platformSigningKeys);
		expect(rows).toHaveLength(1);
		expect(published.keys).toHaveLength(1);
	});

	test("calling it twice at the same instant changes nothing the second time", async () => {
		await advancePlatformSigningKeys(db, { now: T0 });
		await advancePlatformSigningKeys(db, { now: T0 + 90 * DAY_MS });

		let first = await advancePlatformSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let rows = await db.findMany(platformSigningKeys);

		let second = await advancePlatformSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let rowsAfter = await db.findMany(platformSigningKeys);

		expect(second).toEqual(first);
		expect(rowsAfter).toEqual(rows);
	});
});

describe("publishPlatformKeySet", () => {
	test("matches what advancePlatformSigningKeys last published, without performing a transition", async () => {
		let advanced = await advancePlatformSigningKeys(db, { now: T0 });
		let rowsBefore = await db.findMany(platformSigningKeys);

		let republished = await publishPlatformKeySet(db, { now: T0 + 1000 });
		let rowsAfter = await db.findMany(platformSigningKeys);

		expect(republished).toEqual(advanced);
		expect(rowsAfter).toEqual(rowsBefore);
	});
});

describe("ensurePlatformSigningKey", () => {
	test("generates a key when none is signing", async () => {
		let generated = await ensurePlatformSigningKey(db, T0);
		expect(generated).toBe(true);

		let rows = await db.findMany(platformSigningKeys);
		expect(rows).toHaveLength(1);
	});

	test("does nothing when a key is already signing", async () => {
		await ensurePlatformSigningKey(db, T0);
		let generated = await ensurePlatformSigningKey(db, T0 + 1000);

		expect(generated).toBe(false);
		expect(await db.findMany(platformSigningKeys)).toHaveLength(1);
	});
});

describe("currentPlatformSigningKeyPair", () => {
	test("answers null before any key exists", async () => {
		expect(await currentPlatformSigningKeyPair(db)).toBeNull();
	});

	test("hands back a usable pair once a key is signing", async () => {
		await advancePlatformSigningKeys(db, { now: T0 });

		let pair = await currentPlatformSigningKeyPair(db);

		expect(pair).not.toBeNull();
		expect(pair?.alg).toBe("ES256");
		expect(pair?.private).toBeDefined();
		expect(pair?.public).toBeDefined();
	});
});
