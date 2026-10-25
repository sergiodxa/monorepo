/**
 * Drives the DPoP replay store against a real SQLite-backed `SqlStorage`: a proof is
 * claimed once inside its window, claimable again once it lapsed, and swept after.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import {
	claimDPoPProof,
	dpopProofs,
	sweepExpiredDPoPProofs,
} from "~/app/models/tenant/dpop-proofs";
import { runMigrations } from "~/database/tenant-migrations";

let db: Database;

beforeEach(async () => {
	let driver = createSQLStorageDatabaseAdapter(createDurableObjectState().storage.sql);
	await runMigrations(driver);
	db = new Database(driver);
});

describe("claimDPoPProof", () => {
	test("accepts a proof once inside its window", async () => {
		let input = { key: "jkt:jti-1", expiresAt: 2_000, now: 1_000 };

		expect(await claimDPoPProof(db, input)).toBe(true);
		expect(await claimDPoPProof(db, input)).toBe(false);
	});

	test("accepts a key again once its record lapsed", async () => {
		await claimDPoPProof(db, { key: "jkt:jti-1", expiresAt: 2_000, now: 1_000 });

		expect(await claimDPoPProof(db, { key: "jkt:jti-1", expiresAt: 4_000, now: 3_000 })).toBe(true);
	});
});

describe("sweepExpiredDPoPProofs", () => {
	test("deletes lapsed records and keeps live ones", async () => {
		await claimDPoPProof(db, { key: "old", expiresAt: 2_000, now: 1_000 });
		await claimDPoPProof(db, { key: "live", expiresAt: 9_000, now: 1_000 });

		let result = await sweepExpiredDPoPProofs(db, 5_000);

		expect(result).toEqual({ deleted: 1, more: false });
		expect((await db.findMany(dpopProofs)).map((row) => row.key)).toEqual(["live"]);
	});
});
