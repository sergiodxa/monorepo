/**
 * Tests for the command-line `database()` and the `db` command, run through `@sdxc/cli/test`'s
 * `invoke()` over an in-memory SQLite database, so what a handler reads and what the command
 * prints are what a terminal would show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import type { HandlerContext } from "@sdxc/cli";
import type { Database as DataTable } from "remix/data-table";

import { command, commands, createCLI, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { createSqliteDatabase } from "remix/data-table/sqlite";
import { describe, expect, expectTypeOf, test } from "vite-plus/test";

import { DB_COMMAND, Database, database, dbHandler } from "./cli.js";

/** A fresh in-memory database holding two users. */
function openDatabase(): DataTable {
	let sqlite = new DatabaseSync(":memory:");
	sqlite.exec("create table users (id integer primary key, email text not null, name text)");
	sqlite.exec("insert into users (email, name) values ('ada@example.com', 'Ada')");
	sqlite.exec("insert into users (email, name) values ('grace@example.com', null)");
	return createSqliteDatabase(sqlite);
}

/** A CLI mounting the `db` command beside one that reads `ctx.db` itself. */
function setup(db: DataTable | (() => DataTable) = openDatabase()) {
	let contract = commands({ db: DB_COMMAND, count: command({}) });
	let cli = createCLI({ name: "app", commands: contract, middleware: [database(db)] });
	cli.map(contract.db, dbHandler);
	return { cli, contract };
}

describe(database, () => {
	test("publishes the instance as ctx.db and under the Database key", async () => {
		let db = openDatabase();
		let { cli, contract } = setup(db);
		let seen: boolean[] = [];
		cli.map(contract.count, (ctx) => {
			seen.push(ctx.db === db, ctx.get(Database) === db);
			return success();
		});

		let run = await invoke(cli, ["count"]);

		expect(run.code).toBe(0);
		expect(seen).toEqual([true, true]);
	});

	test("calls a source once per run", async () => {
		let opened = 0;
		let { cli, contract } = setup(() => {
			opened++;
			return openDatabase();
		});
		cli.map(contract.count, () => success());

		await invoke(cli, ["count"]);
		await invoke(cli, ["count"]);
		await invoke(cli, ["--help"]);

		expect(opened).toBe(2);
	});

	test("types ctx.db on the handler a CLI derives from its middleware", () => {
		let { cli } = setup();

		expectTypeOf<
			HandlerContext<typeof DB_COMMAND, typeof cli.middleware, []>["db"]
		>().toEqualTypeOf<DataTable>();
	});
});

describe("db command", () => {
	test("prints the rows of one statement passed with --execute", async () => {
		let { cli } = setup();

		let run = await invoke(cli, ["db", "--execute", "select id, email, name from users"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe(
			[
				"id  email              name",
				"--  -----------------  ----",
				"1   ada@example.com    Ada",
				"2   grace@example.com  NULL",
				"(2 rows)",
				"",
			].join("\n"),
		);
	});

	test("prints the affected count of a write", async () => {
		let db = openDatabase();
		let { cli } = setup(db);

		let run = await invoke(cli, ["db", "-e", "update users set name = 'Grace'"]);

		expect(run.stdout).toBe("2 rows affected\n");
		expect((await db.exec("select count(*) as n from users where name = 'Grace'")).rows).toEqual([
			{ n: 2 },
		]);
	});

	test("prints an empty read as zero rows", async () => {
		let { cli } = setup();

		let run = await invoke(cli, ["db", "-e", "select * from users where id = 99"]);

		expect(run.stdout).toBe("(0 rows)\n");
	});

	test("fails with the database's error when --execute is rejected", async () => {
		let { cli } = setup();

		let run = await invoke(cli, ["db", "-e", "select * from missing"]);

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("no such table: missing");
	});

	test("reads statements at the prompt until .exit, carrying on after an error", async () => {
		let { cli } = setup();

		let run = await invoke(cli, ["db"], {
			answers: ["select count(*) as total from users", "select * from missing", "", ".exit"],
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toBe(["total", "-----", "2", "(1 row)", ""].join("\n"));
		expect(run.stderr).toContain("no such table: missing");
	});

	test("ends at once without a terminal", async () => {
		let { cli } = setup();

		let run = await invoke(cli, ["db"], { interactive: false });

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("");
	});

	test("fails naming the missing middleware when nothing published a database", async () => {
		let contract = commands({ db: DB_COMMAND });
		let cli = createCLI({ name: "app", commands: contract });
		cli.map(contract.db, dbHandler);

		let run = await invoke(cli, ["db", "-e", "select 1"]);

		expect(run.code).toBe(1);
		expect(run.stderr).toBe("db read a context key that no middleware published\n");
	});

	test("runs SQL piped into it", async () => {
		let { cli } = setup();

		let run = await invoke(cli, ["db"], { stdin: "select count(*) as n from users;\n" });

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("n\n-\n2\n(1 row)\n");
	});
});
