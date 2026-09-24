/**
 * Runs the data-table store against real SQLite through both production drivers: the D1
 * driver over a D1 binding mock and the Durable Object driver over a `SqlStorage` mock,
 * so the conditional upsert executes as written on each. Also covers the purge and the
 * failures a missing table or an unreadable row produce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1Database, createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure, unwrap } from "@sdxc/result";
import { Database, sql } from "remix/data-table";
import { describe, expect, test } from "vitest";

import {
	DataTableStore,
	IDEMPOTENCY_KEYS_SCHEMA_SQL,
	idempotencyKeys,
	purgeExpired,
} from "./data-table.js";
import { IdempotencyStoreError } from "./errors.js";
import { describeStoreContract } from "./lib/store-contract.js";

/** The instant the purge cases start at. */
const NOW = 1_700_000_000_000;

/** A database on the D1 driver with the package's schema applied. */
async function d1Database(): Promise<Database> {
	let adapter = createD1DatabaseAdapter(createD1Database());
	await adapter.executeScript(IDEMPOTENCY_KEYS_SCHEMA_SQL);
	return new Database(adapter);
}

/** A database on the Durable Object driver with the package's schema applied. */
async function sqlStorageDatabase(): Promise<Database> {
	let adapter = createSQLStorageDatabaseAdapter(createSqlStorage());
	await adapter.executeScript(IDEMPOTENCY_KEYS_SCHEMA_SQL);
	return new Database(adapter);
}

describeStoreContract("DataTableStore on D1", async () => new DataTableStore(await d1Database()));

describeStoreContract(
	"DataTableStore on Durable Object SQLite",
	async () => new DataTableStore(await sqlStorageDatabase()),
);

describe("purgeExpired", () => {
	test("deletes expired records and reports how many went", async () => {
		let db = await d1Database();
		let store = new DataTableStore(db);
		for (let [id, expiresAt] of [
			["old", NOW - 1],
			["edge", NOW],
			["live", NOW + 1],
		] as const) {
			unwrap(await store.claim({ id, fingerprint: null, now: NOW - 10, leaseMs: 5, expiresAt }));
		}

		expect(unwrap(await purgeExpired(db, NOW))).toBe(2);
		expect((await db.findMany(idempotencyKeys)).map((row) => row.id)).toEqual(["live"]);
	});

	test("fails with a store error when the table is missing", async () => {
		let db = new Database(createD1DatabaseAdapter(createD1Database()));
		let result = await purgeExpired(db, NOW);
		expect(isFailure(result) && result.error).toBeInstanceOf(IdempotencyStoreError);
	});
});

describe("DataTableStore failures", () => {
	test("a missing table fails the claim with a store error", async () => {
		let store = new DataTableStore(new Database(createD1DatabaseAdapter(createD1Database())));
		let result = await store.claim({
			id: "a",
			fingerprint: null,
			now: NOW,
			leaseMs: 1_000,
			expiresAt: NOW + 60_000,
		});
		expect(isFailure(result) && result.error).toBeInstanceOf(IdempotencyStoreError);
	});

	test("an unreadable stored response fails the claim with a store error", async () => {
		let db = await d1Database();
		await db.exec(
			sql`insert into idempotency_keys (id, fingerprint, lease, state, response, lease_expires_at, expires_at) values (${"a"}, ${null}, ${"l"}, ${"completed"}, ${"{not json"}, ${NOW}, ${NOW + 60_000})`,
		);

		let result = await new DataTableStore(db).claim({
			id: "a",
			fingerprint: null,
			now: NOW,
			leaseMs: 1_000,
			expiresAt: NOW + 60_000,
		});
		expect(isFailure(result) && result.error).toBeInstanceOf(IdempotencyStoreError);
	});
});
