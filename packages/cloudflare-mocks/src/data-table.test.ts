import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { column as c, Database, table } from "remix/data-table";
/**
 * Parity tests that drive the real `remix/data-table` D1 and SqlStorage adapters against
 * the mocks in this package. They are the package's fidelity contract: if a mock drifts
 * from the shape or semantics an adapter depends on, these fail rather than production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "vitest";

import { createD1Database } from "./d1";
import { createSqlStorage } from "./sql-storage";

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

/** Builds a `remix/data-table` handle over the D1 mock with the `users` table created. */
async function setupD1() {
	let binding = createD1Database();
	await binding.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
	return new Database(createD1DatabaseAdapter(binding));
}

/** Builds a `remix/data-table` handle over the SqlStorage mock with `users` created. */
function setupSqlStorage() {
	let binding = createSqlStorage();
	binding.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
	return new Database(createSQLStorageDatabaseAdapter(binding));
}

describe("createD1Database with the D1 data-table adapter", () => {
	let db: Awaited<ReturnType<typeof setupD1>>;

	beforeEach(async () => {
		db = await setupD1();
	});

	test("reads and writes round-trip through generated SQL", async () => {
		let created = await db.create(users, { id: 5, email: "five@example.com" }, { returnRow: true });
		expect(created.email).toBe("five@example.com");

		let found = await db.findOne(users, { where: { id: 5 } });
		expect(found?.email).toBe("five@example.com");

		let updated = await db.update(users, 5, { email: "updated@example.com" });
		expect(updated.email).toBe("updated@example.com");

		expect(await db.count(users)).toBe(1);
	});

	test("commits every write when the transaction succeeds", async () => {
		await db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			await tx.create(users, { id: 2, email: "second@example.com" });
		});

		expect(await db.count(users)).toBe(2);
	});

	test("RETURNING inside a transaction resolves because statements run immediately", async () => {
		let updated = await db.transaction(async (tx) => {
			await tx.create(users, { id: 9, email: "nine@example.com" });
			return tx.update(users, 9, { email: "changed@example.com" });
		});

		expect(updated.email).toBe("changed@example.com");
	});

	test("reproduces D1's lack of rollback instead of hiding it behind SQLite", async () => {
		let boom = new Error("second statement failed");

		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);

		// The mock must autocommit each statement like D1 does. If this ever reads 0 the
		// mock has started wrapping the scope in a SQLite transaction, which would make
		// tests pass against behavior production does not have.
		expect(await db.count(users)).toBe(1);
	});

	test("raw SELECT returns rows and raw DELETE reports affectedRows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let selected = await db.exec("SELECT email FROM users WHERE id = ?", [2]);
		expect(selected.rows).toEqual([{ email: "two@example.com" }]);

		let cte = await db.exec("WITH ranked AS (SELECT email FROM users) SELECT * FROM ranked");
		expect(cte.rows).toHaveLength(2);

		let deleted = await db.exec("DELETE FROM users WHERE id = ?", [1]);
		expect(deleted.affectedRows).toBe(1);
		expect(await db.count(users)).toBe(1);
	});

	test("c.json() columns round-trip because the mock rejects unencoded objects", async () => {
		await db.exec("CREATE TABLE settings (id INTEGER PRIMARY KEY, config TEXT)");

		let config = { strategy: "email", config: { to: "user@example.com" } };
		let created = await db.create(settings, { id: 1, config }, { returnRow: true });
		expect(created.config).toEqual(config);

		let found = await db.findOne(settings, { where: { id: 1 } });
		expect(found?.config).toEqual(config);
	});

	test("surfaces constraint violations as real SQLite errors", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });

		let promise = db.create(users, { id: 1, email: "duplicate@example.com" });
		await expect(promise).rejects.toThrow();
	});

	test("reports affectedRows from meta.changes rather than the row count", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let result = await db.exec("UPDATE users SET email = ?", ["same@example.com"]);
		expect(result.affectedRows).toBe(2);
	});
});

describe("createSqlStorage with the SqlStorage data-table adapter", () => {
	let db: ReturnType<typeof setupSqlStorage>;

	beforeEach(() => {
		db = setupSqlStorage();
	});

	test("reads and writes round-trip through generated SQL", async () => {
		let created = await db.create(users, { id: 5, email: "five@example.com" }, { returnRow: true });
		expect(created.email).toBe("five@example.com");

		expect(await db.count(users)).toBe(1);
	});

	test("rolls back every write when a transaction throws", async () => {
		let boom = new Error("second statement failed");

		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);
		expect(await db.count(users)).toBe(0);
	});

	test("nested transactions roll back independently via savepoints", async () => {
		await db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "outer@example.com" });

			let inner = tx.transaction(async (nested) => {
				await nested.create(users, { id: 2, email: "inner@example.com" });
				throw new Error("inner fail");
			});
			await expect(inner).rejects.toThrow();
		});

		let rows = await db.findMany(users, { orderBy: ["id"] });
		expect(rows.map((row) => row.id)).toEqual([1]);
	});

	test("reads issued inside a transaction observe that transaction's writes", async () => {
		let created = await db.transaction(async (tx) => {
			let row = await tx.create(users, { id: 7, email: "seven@example.com" }, { returnRow: true });
			expect(await tx.count(users)).toBe(1);
			return row;
		});

		expect(created.id).toBe(7);
	});

	test("raw SELECT returns rows and raw DELETE reports affectedRows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let selected = await db.exec("SELECT email FROM users WHERE id = ?", [2]);
		expect(selected.rows).toEqual([{ email: "two@example.com" }]);

		let deleted = await db.exec("DELETE FROM users WHERE id = ?", [1]);
		expect(deleted.affectedRows).toBe(1);
	});

	test("c.json() columns round-trip because the mock rejects unencoded objects", async () => {
		await db.exec("CREATE TABLE settings (id INTEGER PRIMARY KEY, config TEXT)");

		let config = { strategy: "email", config: { to: "user@example.com" } };
		let created = await db.create(settings, { id: 1, config }, { returnRow: true });
		expect(created.config).toEqual(config);

		let found = await db.findOne(settings, { where: { id: 1 } });
		expect(found?.config).toEqual(config);
	});

	test("executeScript runs a multi-statement migration script", async () => {
		await db.exec(
			"CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT); CREATE INDEX posts_title ON posts (title)",
		);

		let result = await db.exec("SELECT name FROM sqlite_master WHERE type = ?", ["index"]);
		expect(result.rows).toEqual([{ name: "posts_title" }]);
	});
});
