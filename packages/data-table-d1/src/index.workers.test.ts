/**
 * Tests for the D1 `DatabaseDriver`, run inside workerd against a real Cloudflare D1 binding,
 * covering what D1 itself defines: `exec()` results per statement shape, `c.json()`/`c.boolean()`
 * round-tripping, statement observation, and that a failing transaction leaves earlier writes intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env, reset } from "cloudflare:test";
import { column as c, Database, table } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { D1StatementObservation, D1StatementObserver } from "./index.js";

import { createD1DatabaseAdapter } from "./index.js";

let users = table({
	name: "users",
	columns: {
		id: c.integer().primaryKey(),
		email: c.varchar(255),
	},
});

let settings = table({
	name: "settings",
	columns: {
		id: c.integer().primaryKey(),
		config: c.json(),
	},
});

let flags = table({
	name: "flags",
	columns: {
		id: c.integer().primaryKey(),
		enabled: c.boolean(),
		archived: c.boolean().nullable(),
	},
});

/** The schema every test starts from, applied to a database `setup` has just reset. */
const SCHEMA = [
	"CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);",
	"CREATE TABLE settings (id INTEGER PRIMARY KEY, config TEXT);",
	"CREATE TABLE flags (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL, archived INTEGER);",
].join("\n");

/**
 * Builds an adapter over the real D1 binding and applies the schema, after resetting the
 * binding — shared across the file — so each test starts from empty tables that `count()`
 * assertions can rely on.
 * @param onStatement Observer to install, when a test asserts on what was reported.
 */
async function setup(onStatement?: D1StatementObserver) {
	await reset();
	let adapter = createD1DatabaseAdapter(env.DB, onStatement ? { onStatement } : undefined);
	await adapter.executeScript(SCHEMA);
	return { adapter, db: new Database(adapter) };
}

describe("createD1DatabaseAdapter", () => {
	let db: Database;

	beforeEach(async () => {
		db = (await setup()).db;
	});

	test("does not advertise savepoint support", () => {
		expect(createD1DatabaseAdapter(env.DB).capabilities.savepoints).toBe(false);
	});

	test("commits every write when the transaction succeeds", async () => {
		await db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			await tx.create(users, { id: 2, email: "second@example.com" });
		});

		expect(await db.count(users)).toBe(2);
	});

	test("basic reads and writes work outside a transaction", async () => {
		let created = await db.create(users, { id: 5, email: "five@example.com" }, { returnRow: true });
		expect(created.email).toBe("five@example.com");

		let found = await db.findOne(users, { where: { id: 5 } });
		expect(found?.email).toBe("five@example.com");

		let updated = await db.update(users, 5, { email: "updated@example.com" });
		expect(updated.email).toBe("updated@example.com");

		expect(await db.count(users)).toBe(1);
	});

	/**
	 * `create`/`update` need synchronous RETURNING results, which the adapter can only supply by
	 * executing each statement immediately — the reason the transaction scope cannot be atomic.
	 */
	test("RETURNING inside a transaction works because statements run immediately", async () => {
		let updated = await db.transaction(async (tx) => {
			await tx.create(users, { id: 9, email: "nine@example.com" });
			return tx.update(users, 9, { email: "changed@example.com" });
		});

		expect(updated.email).toBe("changed@example.com");
	});

	test("db.exec() with a raw SELECT returns rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let result = await db.exec("SELECT email FROM users WHERE id = ?", [2]);

		expect(result.rows).toEqual([{ email: "two@example.com" }]);
	});

	test("db.exec() with a raw WITH/CTE query returns rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });

		let result = await db.exec("WITH ranked AS (SELECT email FROM users) SELECT * FROM ranked");

		expect(result.rows).toEqual([{ email: "one@example.com" }]);
	});

	test("db.exec() with a raw DELETE still reports affectedRows, not rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let result = await db.exec("DELETE FROM users WHERE id = ?", [1]);

		expect(result.affectedRows).toBe(1);
		expect(await db.count(users)).toBe(1);
	});

	/**
	 * `affectedRows` must match what the same statement without `RETURNING` reports, so adding
	 * the clause never changes what an existing caller reads back.
	 */
	test("db.exec() with a raw UPDATE ... RETURNING yields the rows it moved", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let result = await db.exec(
			"UPDATE users SET email = email || ? WHERE id = ? RETURNING id, email",
			[".updated", 1],
		);

		expect(result.rows).toEqual([{ id: 1, email: "one@example.com.updated" }]);
		expect(result.affectedRows).toBe(1);
	});

	test("a raw UPDATE ... RETURNING that matches nothing yields no rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });

		let result = await db.exec("UPDATE users SET email = ? WHERE id = ? RETURNING id", [
			"nobody@example.com",
			999,
		]);

		expect(result.rows).toEqual([]);
		expect(result.affectedRows).toBe(0);
	});

	test("a raw DELETE ... RETURNING yields the deleted rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let result = await db.exec("DELETE FROM users WHERE id = ? RETURNING id, email", [2]);

		expect(result.rows).toEqual([{ id: 2, email: "two@example.com" }]);
		expect(result.affectedRows).toBe(1);
		expect(await db.count(users)).toBe(1);
	});

	test("c.json() columns round-trip through create/findOne without throwing", async () => {
		let config = { strategy: "email", config: { to: "user@example.com" } };
		let created = await db.create(settings, { id: 1, config }, { returnRow: true });

		expect(created.config).toEqual(config);

		let found = await db.findOne(settings, { where: { id: 1 } });
		expect(found?.config).toEqual(config);
	});

	/**
	 * Asserts identity, not truthiness: a leaked `0` used to render `checked="0"`, an HTML boolean
	 * attribute that reads as ON, so a stored `false` came back ticked. `archived`'s `null` is a
	 * third state that must survive the decode, or a `?? true` default written over it stops firing.
	 */
	test("c.boolean() columns read back as real booleans, not SQLite's 1 and 0", async () => {
		await db.create(flags, { id: 1, enabled: false, archived: null });
		await db.create(flags, { id: 2, enabled: true, archived: true });

		let off = await db.findOne(flags, { where: { id: 1 } });
		let on = await db.findOne(flags, { where: { id: 2 } });

		expect(off?.enabled).toBe(false);
		expect(on?.enabled).toBe(true);

		expect(off?.archived).toBe(null);
		expect(on?.archived).toBe(true);
	});

	test("c.boolean() columns decode on the returning path too, not only on select", async () => {
		let created = await db.create(
			flags,
			{ id: 1, enabled: false, archived: null },
			{ returnRow: true },
		);
		expect(created.enabled).toBe(false);

		let updated = await db.update(flags, 1, { enabled: true });
		expect(updated.enabled).toBe(true);
	});

	/**
	 * D1 auto-commits each statement immediately, so a write made before a later failure stays
	 * committed; this pins that behavior against the real binding rather than a shim's imitation.
	 * A result other than 1 here would mean the adapter gained atomicity worth revisiting the docs for.
	 */
	test("DOCUMENTS D1 limitation: a failing transaction does NOT roll back earlier writes", async () => {
		let boom = new Error("second statement failed");

		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);

		expect(await db.count(users)).toBe(1);
	});
});

describe("createD1DatabaseAdapter onStatement", () => {
	test("reports one observation per executed statement", async () => {
		let observations: D1StatementObservation[] = [];
		let { db } = await setup((observation) => observations.push(observation));

		await db.create(users, { id: 1, email: "one@example.com" });
		await db.findOne(users, { where: { id: 1 } });

		expect(observations).toHaveLength(2);
		expect(observations.map((observation) => observation.kind)).toEqual(["insert", "select"]);
		expect(observations.map((observation) => observation.table)).toEqual(["users", "users"]);
	});

	/**
	 * A real binding measures `durationMs`, so only its shape can be asserted here; that the
	 * adapter reads it from `meta` instead of timing the call itself is pinned in `index.test.ts`.
	 */
	test("surfaces the row counters D1 itself reports", async () => {
		let observations: D1StatementObservation[] = [];
		let { db } = await setup((observation) => observations.push(observation));

		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });
		observations.length = 0;

		await db.findMany(users);

		expect(observations).toHaveLength(1);
		expect(observations[0]?.rowsRead).toBe(2);
		expect(observations[0]?.rowsWritten).toBe(0);
		expect(typeof observations[0]?.durationMs).toBe("number");
	});

	test("counts a write's rows written from meta rather than from returned rows", async () => {
		let observations: D1StatementObservation[] = [];
		let { db } = await setup((observation) => observations.push(observation));

		await db.create(users, { id: 1, email: "one@example.com" });

		expect(observations[0]?.rowsWritten).toBe(1);
	});

	test("reports a raw statement with no table", async () => {
		let observations: D1StatementObservation[] = [];
		let { db } = await setup((observation) => observations.push(observation));

		await db.exec("SELECT 1 as one");

		expect(observations).toHaveLength(1);
		expect(observations[0]?.kind).toBe("raw");
		expect(observations[0]?.table).toBeUndefined();
	});

	test("an observer that throws does not fail the statement it was measuring", async () => {
		let { db } = await setup(() => {
			throw new Error("logging blew up");
		});

		let created = await db.create(
			users,
			{ id: 7, email: "seven@example.com" },
			{ returnRow: true },
		);

		expect(created.email).toBe("seven@example.com");
		expect(await db.count(users)).toBe(1);
	});

	test("an adapter without an observer behaves exactly as before", async () => {
		let { db } = await setup();

		await db.create(users, { id: 1, email: "one@example.com" });

		expect(await db.count(users)).toBe(1);
	});
});
