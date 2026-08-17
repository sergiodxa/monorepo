/**
 * Bun-side driver for the `db` plugin's end-to-end assertions. It runs the DDL/DML/SELECT
 * shaping, the SQL-error path and the connection-reuse lifecycle against a real temp-file
 * SQLite database, then writes what it observed to stdout as one JSON object.
 *
 * It exists because the plugin's connection comes from Bun's SQL client, which has no `node:`
 * counterpart: the assertions belong to Vitest, but the code under test has to execute under
 * Bun. Keeping this side purely observational — it records values and never asserts — is what
 * leaves the expectations in `db.test.ts` where a failure names them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { PermissionSet } from "../permissions";
import type { ToolContext } from "../plugin";
import type { Value, ValueObject } from "../values";
import type { Workspace } from "../workspace";

import { ToolError } from "../errors";

import { createDbPlugin } from "./db";

/** A permission set granting every family; the driver's grants are not what is under test. */
function allowAll(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

/** A workspace stub; the `db` plugin never touches it, but the context needs one. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-db-e2e",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
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

/**
 * Run every end-to-end scenario against `dbPath` and return the observations as plain JSON.
 *
 * The shape mirrors the assertions in `db.test.ts` one-for-one, so a new expectation there
 * needs a new field here rather than a reinterpretation of an existing one.
 */
async function observe(dbPath: string): Promise<Record<string, unknown>> {
	process.env.DATABASE_URL = `sqlite://${dbPath}`;
	let plugin = createDbPlugin();
	let context: ToolContext = { workspace: stubWorkspace(), permissions: allowAll() };

	let created = asObject(
		expectSuccess(
			await plugin.call(
				"query",
				[{ kind: "value", value: "CREATE TABLE ledger (id INTEGER PRIMARY KEY, entry TEXT)" }],
				context,
			),
		),
	);
	let inserted = asObject(
		expectSuccess(
			await plugin.call(
				"query",
				[{ kind: "value", value: "INSERT INTO ledger (entry) VALUES ('a')" }],
				context,
			),
		),
	);
	let insertedMany = asObject(
		expectSuccess(
			await plugin.call(
				"query",
				[{ kind: "value", value: "INSERT INTO ledger (entry) VALUES ('b'), ('c')" }],
				context,
			),
		),
	);
	let selected = asObject(
		expectSuccess(
			await plugin.call(
				"query",
				[{ kind: "value", value: "SELECT id, entry FROM ledger ORDER BY id" }],
				context,
			),
		),
	);

	// The failure path: a missing table must surface the database's own message.
	let errorResult = await plugin.call(
		"query",
		[{ kind: "value", value: "SELECT * FROM does_not_exist" }],
		context,
	);
	if (!isFailure(errorResult)) throw new Error("expected the missing-table query to fail");
	let sqlError = {
		isToolError: errorResult.error instanceof ToolError,
		code: errorResult.error.code,
		message: errorResult.error.message,
	};

	// Connection reuse: two writes landing in one table is the observable proof that the
	// same handle served every call.
	expectSuccess(
		await plugin.call(
			"query",
			[{ kind: "value", value: "CREATE TABLE IF NOT EXISTS reuse (id INTEGER PRIMARY KEY)" }],
			context,
		),
	);
	expectSuccess(
		await plugin.call(
			"query",
			[{ kind: "value", value: "INSERT INTO reuse DEFAULT VALUES" }],
			context,
		),
	);
	expectSuccess(
		await plugin.call(
			"query",
			[{ kind: "value", value: "INSERT INTO reuse DEFAULT VALUES" }],
			context,
		),
	);
	let reuseCounted = asObject(
		expectSuccess(
			await plugin.call("query", [{ kind: "value", value: "SELECT id FROM reuse" }], context),
		),
	);

	// dispose is idempotent and best-effort: calling it twice never throws.
	let disposeThrew = false;
	if (plugin.dispose !== undefined) {
		try {
			await plugin.dispose();
			await plugin.dispose();
		} catch {
			disposeThrew = true;
		}
	}

	return {
		created: { rows: created.rows, count: created.count },
		inserted: { rows: inserted.rows, count: inserted.count, affected_rows: inserted.affected_rows },
		insertedMany: { affected_rows: insertedMany.affected_rows },
		selected: {
			rows: selected.rows,
			count: selected.count,
			affected_rows: selected.affected_rows,
		},
		sqlError,
		reuse: { count: reuseCounted.count, disposeThrew },
	};
}

let dbPath = process.argv[2];
if (dbPath === undefined) throw new Error("usage: db-e2e-probe.ts <sqlite-path>");
process.stdout.write(JSON.stringify(await observe(dbPath)));
