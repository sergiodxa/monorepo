/**
 * Tests for `database()`, driven through a real `remix/router` over an in-memory SQLite
 * database, so what a handler reads off `ctx.db` and the `Database` key is the instance the
 * middleware was given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { sql } from "remix/data-table";
import { createSqliteDatabase } from "remix/data-table/sqlite";
import { createRouter } from "remix/router";
import { describe, expect, expectTypeOf, test } from "vitest";

import { Database, database } from "./index.js";

/** A fresh in-memory database, distinct from every other one a test opens. */
function openDatabase(): DataTable {
	return createSqliteDatabase(new DatabaseSync(":memory:"));
}

describe(database, () => {
	test("publishes the instance as ctx.db", async () => {
		let db = openDatabase();
		let seen: DataTable[] = [];
		let router = createRouter({ middleware: [database(db)] });
		router.get("/", (ctx) => {
			seen.push(ctx.db);
			return new Response("ok");
		});

		await router.fetch("https://example.com/");
		await router.fetch("https://example.com/");

		expect(seen).toEqual([db, db]);
		expect(seen[0]).toBe(db);
	});

	test("the Database key reads the same instance", async () => {
		let db = openDatabase();
		let router = createRouter({ middleware: [database(db)] });
		router.get("/", (ctx) => new Response(String(ctx.get(Database) === ctx.db && ctx.db === db)));

		let response = await router.fetch("https://example.com/");

		expect(await response.text()).toBe("true");
	});

	test("a later middleware queries through ctx.db", async () => {
		let db = openDatabase();
		let rows: unknown[] = [];
		let answer: Middleware = async (ctx, next) => {
			let result = await ctx.db.exec(sql`select 41 + 1 as answer`);
			rows.push(...(result.rows ?? []));
			return next();
		};
		let router = createRouter({ middleware: [database(db), answer] });
		router.get("/", () => new Response("ok"));

		await router.fetch("https://example.com/");

		expect(rows).toEqual([{ answer: 42 }]);
	});

	test("types ctx.db on a router derived from its middleware list", () => {
		let router = createRouter({ middleware: [database(openDatabase())] });
		router.get("/", (ctx) => {
			expectTypeOf(ctx.db).toEqualTypeOf<DataTable>();
			expectTypeOf(ctx.get(Database)).toEqualTypeOf<DataTable>();
			return new Response("ok");
		});
	});
});
