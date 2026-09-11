/**
 * Bun-side driver for the `db` plugin's end-to-end assertions. It runs result shaping,
 * parameter binding, `one`, `run_file` seeding, connection selection, the SQL-error path
 * and the connection-reuse lifecycle against two real temp-file SQLite databases, then
 * writes what it observed to stdout as one JSON object.
 *
 * It exists because the plugin's connections come from Bun's SQL client, which has no
 * `node:` counterpart: the assertions belong to Vitest, but the code under test has to
 * execute under Bun. Keeping this side purely observational — it records values and never
 * asserts — is what leaves the expectations in `db.test.ts` where a failure names them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { createConnectionSet } from "../bases.js";
import { ToolError } from "../errors.js";
import { createPermissionSet } from "../permissions.js";
import { createToolContext } from "../tool-context.js";

import { createDbPlugin } from "./db.js";

/** The SQL a `run_file` observation applies: three statements, one call. */
const SEED_SQL = `CREATE TABLE IF NOT EXISTS seeded (id INTEGER PRIMARY KEY, label TEXT);
DELETE FROM seeded;
INSERT INTO seeded (label) VALUES ('first');
INSERT INTO seeded (label) VALUES ('second; not a separator');
`;

/** Wrap a runtime value as a positional value argument. */
function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** Wrap a bare identifier as a word argument. */
function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** Unwrap a successful result, or throw so the driver exits non-zero with the message. */
function expectSuccess(result: Result<Value, SpecError>): Value {
	if (isFailure(result)) throw new Error(`expected success, got: ${result.error.message}`);
	return result.data;
}

/** Read a result value as an object, throwing when the plugin returned another shape. */
function asObject(data: Value): ValueObject {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`expected an object result, got ${JSON.stringify(data)}`);
	}
	return data;
}

/** Record how a call failed, or throw when it unexpectedly succeeded. */
function expectFailure(label: string, result: Result<Value, SpecError>): ValueObject {
	if (!isFailure(result)) throw new Error(`expected ${label} to fail`);
	return {
		isToolError: result.error instanceof ToolError,
		code: result.error.code,
		message: result.error.message,
	};
}

/**
 * Run every end-to-end scenario against the two SQLite files and return the observations
 * as plain JSON.
 *
 * The shape mirrors the assertions in `db.test.ts` one-for-one: a new expectation there
 * gets a new field here, each field carrying one fixed meaning.
 */
async function observe(primary: string, secondary: string): Promise<Record<string, unknown>> {
	let plugin = createDbPlugin();
	let context = createToolContext({
		connections: createConnectionSet([
			{ name: "web", url: `sqlite://${primary}` },
			{ name: "backend", url: `sqlite://${secondary}` },
		]),
		permissions: createPermissionSet({
			run: { mode: "denied" },
			net: { mode: "denied" },
			env: { mode: "denied" },
			hostFs: { mode: "all" },
			db: { mode: "all" },
		}),
	});

	/** Every call names its connection, since two are configured. */
	let on: ToolArg[] = [word("on"), value("web")];
	async function query(sql: string, ...extra: ToolArg[]): Promise<Result<Value, SpecError>> {
		return await plugin.call("query", [value(sql), ...extra, ...on], context);
	}

	let created = asObject(
		expectSuccess(await query("CREATE TABLE ledger (id INTEGER PRIMARY KEY, entry TEXT)")),
	);
	let inserted = asObject(expectSuccess(await query("INSERT INTO ledger (entry) VALUES ('a')")));
	let insertedMany = asObject(
		expectSuccess(await query("INSERT INTO ledger (entry) VALUES ('b'), ('c')")),
	);
	let selected = asObject(expectSuccess(await query("SELECT id, entry FROM ledger ORDER BY id")));

	/** Parameters bind positionally, so the array fills $1 and $2 in order. */
	let parameterized = asObject(
		expectSuccess(
			await query(
				"SELECT id, entry FROM ledger WHERE entry = $1 AND id = $2",
				word("params"),
				value(["b", 2]),
			),
		),
	);
	let one = expectSuccess(
		await query(
			"SELECT id, entry FROM ledger WHERE entry = $1",
			word("params"),
			value("a"),
			word("one"),
		),
	);
	let oneOfMany = expectFailure(
		"one over three rows",
		await query("SELECT id FROM ledger", word("one")),
	);
	let oneOfNone = expectFailure(
		"one over no rows",
		await query("SELECT id FROM ledger WHERE entry = 'absent'", word("one")),
	);

	let seedPath = join(await mkdtemp(join(tmpdir(), "spec-db-seed-")), "seed.sql");
	await writeFile(seedPath, SEED_SQL, "utf8");
	let seeded = asObject(
		expectSuccess(await plugin.call("run_file", [value(seedPath), ...on], context)),
	);
	let seededRows = asObject(expectSuccess(await query("SELECT id FROM seeded")));

	/** The second connection is a separate database, reached only by name. */
	expectSuccess(
		await plugin.call(
			"query",
			[value("CREATE TABLE notes (note TEXT)"), word("on"), value("backend")],
			context,
		),
	);
	expectSuccess(
		await plugin.call(
			"query",
			[value("INSERT INTO notes (note) VALUES ('elsewhere')"), word("on"), value("backend")],
			context,
		),
	);
	let secondConnection = asObject(
		expectSuccess(
			await plugin.call(
				"query",
				[value("SELECT note FROM notes"), word("on"), value("backend")],
				context,
			),
		),
	);

	let sqlError = expectFailure("a missing table", await query("SELECT * FROM does_not_exist"));

	/**
	 * Connection reuse: two writes landing in one table is the observable
	 * proof that the same handle served every call on that name.
	 */
	expectSuccess(await query("CREATE TABLE IF NOT EXISTS reuse (id INTEGER PRIMARY KEY)"));
	expectSuccess(await query("INSERT INTO reuse DEFAULT VALUES"));
	expectSuccess(await query("INSERT INTO reuse DEFAULT VALUES"));
	let reuseCounted = asObject(expectSuccess(await query("SELECT id FROM reuse")));

	return {
		created: { rows: created.rows, count: created.count },
		inserted: { rows: inserted.rows, count: inserted.count, affected_rows: inserted.affected_rows },
		insertedMany: { affected_rows: insertedMany.affected_rows },
		selected: {
			rows: selected.rows,
			count: selected.count,
			affected_rows: selected.affected_rows,
		},
		parameterized: { rows: parameterized.rows, count: parameterized.count },
		one,
		oneOfMany,
		oneOfNone,
		seeded: { affected_rows: seeded.affected_rows },
		seededRows: { count: seededRows.count },
		secondConnection: { rows: secondConnection.rows },
		sqlError,
		reuse: { count: reuseCounted.count, disposeThrew: await disposeTwice(plugin) },
	};
}

/** dispose is idempotent and best-effort: calling it twice never throws. */
async function disposeTwice(plugin: Plugin): Promise<boolean> {
	if (plugin.dispose === undefined) return false;
	try {
		await plugin.dispose();
		await plugin.dispose();
		return false;
	} catch {
		return true;
	}
}

let [primary, secondary] = process.argv.slice(2);
if (primary === undefined || secondary === undefined) {
	throw new Error("usage: db-e2e-probe.ts <sqlite-path> <other-sqlite-path>");
}
process.stdout.write(JSON.stringify(await observe(primary, secondary)));
