/**
 * Tests for the built-in `db` plugin. The unit tests never open a database:
 * they exercise the static descriptor, argument validation, the scoped
 * `DATABASE_URL` permission check, and the unset-variable configuration error,
 * all before a connection would be attempted. The end-to-end tests drive a real
 * temp-file SQLite database through Bun's SQL client and cover the row/count
 * shaping and lifecycle; the functional acceptance layer lives in
 * `db-example.test.ts`, which runs the CLI against `examples/db`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";
import { SQL } from "bun";

import type { SpecError } from "../errors";
import type { PermissionSet } from "../permissions";
import type { ToolContext } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";
import type { Workspace } from "../workspace";

import { PermissionDeniedError, ToolError } from "../errors";

import { createDbPlugin } from "./db";

/** Whether Bun's SQL client exposes SQLite; gates the end-to-end suite. */
const SQLITE_AVAILABLE = "SQLiteError" in SQL;

/** Wrap a runtime value as a positional value argument. */
function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** Wrap a bare identifier as a word argument. */
function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** A permission set that grants every family; env checks record their names. */
function allowAll(envCalls: string[] = []): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: (name) => {
			envCalls.push(name);
			return success(undefined);
		},
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

/** A permission set whose env family is scoped away from a given variable. */
function envScopedTo(granted: string): PermissionSet {
	return {
		...allowAll(),
		checkEnv: (name) =>
			name === granted
				? success(undefined)
				: failure(new PermissionDeniedError("env", name, `spec run --allow-env=${name}`)),
	};
}

/** A workspace stub; the `db` plugin never touches it, but the context needs one. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-db-unit",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

/** Build a tool context from a permission set (defaults to allow-all). */
function buildContext(permissions: PermissionSet = allowAll()): ToolContext {
	return { workspace: stubWorkspace(), permissions };
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

/** Narrow to the success data or fail the test with the error's message. */
function expectSuccess(result: Result<Value, SpecError>): Value {
	if (isFailure(result)) throw new Error(`Expected success, got: ${result.error.message}`);
	return result.data;
}

/** Read a result value as an object, failing the test when it is not one. */
function asObject(data: Value): ValueObject {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`expected an object result, got ${JSON.stringify(data)}`);
	}
	return data;
}

describe(createDbPlugin.name, () => {
	let plugin = createDbPlugin();

	test("describes a single query action requiring the env permission", () => {
		expect(plugin.namespace).toBe("db");
		let tools = plugin.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["query"]);
		let query = tools[0];
		expect(query?.kind).toBe("action");
		expect(query?.requires).toBe("env");
		expect(query?.params.map((param) => [param.name, param.kind, param.required])).toEqual([
			["sql", "value", true],
		]);
	});

	test("describe never opens a connection, so it needs no DATABASE_URL", () => {
		// Calling describe repeatedly is pure and side-effect-free: a suite that
		// never touches db.* pays nothing and never reads the environment.
		let previous = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;
		try {
			expect(plugin.describe()).toEqual(createDbPlugin().describe());
		} finally {
			if (previous !== undefined) process.env.DATABASE_URL = previous;
		}
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let error = unwrapError(await plugin.call("execute", [value("SELECT 1")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('db has no tool named "execute"');
		expect(error.message).toContain("query");
	});

	test("query rejects a missing argument", async () => {
		let error = unwrapError(await plugin.call("query", [], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("exactly one argument");
	});

	test("query rejects extra arguments", async () => {
		let error = unwrapError(
			await plugin.call("query", [value("SELECT 1"), value("SELECT 2")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("exactly one argument");
	});

	test("query rejects a bare word for the SQL argument", async () => {
		let error = unwrapError(await plugin.call("query", [word("SELECT")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("SQL string");
	});

	test("query rejects a non-string SQL argument", async () => {
		let error = unwrapError(await plugin.call("query", [value(42)], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("SQL string");
	});

	test("query checks DATABASE_URL against the caller's grants", async () => {
		let error = unwrapError(
			await plugin.call("query", [value("SELECT 1")], buildContext(envScopedTo("OTHER_VAR"))),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.code).toBe("permission-denied");
		expect((error as PermissionDeniedError).resource).toBe("DATABASE_URL");
		expect(error.remedy).toBe("spec run --allow-env=DATABASE_URL");
	});

	test("query asks the permission set about DATABASE_URL by name", async () => {
		let envCalls: string[] = [];
		// Env is granted but DATABASE_URL is unset, so this stops at the config
		// error; the point is that the scoped check named DATABASE_URL.
		let previous = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;
		try {
			await plugin.call("query", [value("SELECT 1")], buildContext(allowAll(envCalls)));
		} finally {
			if (previous !== undefined) process.env.DATABASE_URL = previous;
		}
		expect(envCalls).toEqual(["DATABASE_URL"]);
	});

	test("an unset DATABASE_URL is a configuration tool error, not a connection attempt", async () => {
		let previous = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;
		try {
			let error = unwrapError(await plugin.call("query", [value("SELECT 1")], buildContext()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("DATABASE_URL");
			expect(error.message).toContain("unset or empty");
		} finally {
			if (previous !== undefined) process.env.DATABASE_URL = previous;
		}
	});

	test("a whitespace-only DATABASE_URL is treated as unset", async () => {
		let previous = process.env.DATABASE_URL;
		process.env.DATABASE_URL = "   ";
		try {
			let error = unwrapError(await plugin.call("query", [value("SELECT 1")], buildContext()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("unset or empty");
		} finally {
			if (previous === undefined) delete process.env.DATABASE_URL;
			else process.env.DATABASE_URL = previous;
		}
	});
});

// The end-to-end suite proves row/count shaping and the connection lifecycle
// against a real SQLite database in a temp file. It is skipped when Bun's SQL
// client has no SQLite driver, so the unit suite stays green regardless.
describe("db end to end (SQLite)", () => {
	let plugin = createDbPlugin();
	let dbPath = join(tmpdir(), `spec-db-e2e-${process.pid}-${Date.now()}.sqlite`);
	let previous: string | undefined;
	let context: ToolContext;

	beforeAll(() => {
		previous = process.env.DATABASE_URL;
		process.env.DATABASE_URL = `sqlite://${dbPath}`;
		context = buildContext();
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		if (previous === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = previous;
		for (let suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
	});

	test.skipIf(!SQLITE_AVAILABLE)("shapes DDL, DML and SELECT results", async () => {
		let created = asObject(
			expectSuccess(
				await plugin.call(
					"query",
					[value("CREATE TABLE ledger (id INTEGER PRIMARY KEY, entry TEXT)")],
					context,
				),
			),
		);
		expect(created.rows).toEqual([]);
		expect(created.count).toBe(0);

		// An INSERT reports the rows it changed as affected_rows, with no rows
		// returned — the canonical `expect result.affected_rows 1` shape.
		let inserted = asObject(
			expectSuccess(
				await plugin.call("query", [value("INSERT INTO ledger (entry) VALUES ('a')")], context),
			),
		);
		expect(inserted.affected_rows).toBe(1);
		expect(inserted.count).toBe(0);
		expect(inserted.rows).toEqual([]);

		let insertedMany = asObject(
			expectSuccess(
				await plugin.call(
					"query",
					[value("INSERT INTO ledger (entry) VALUES ('b'), ('c')")],
					context,
				),
			),
		);
		expect(insertedMany.affected_rows).toBe(2);

		// A SELECT returns rows; affected_rows and count both equal the row count.
		let selected = asObject(
			expectSuccess(
				await plugin.call("query", [value("SELECT id, entry FROM ledger ORDER BY id")], context),
			),
		);
		expect(selected.count).toBe(3);
		expect(selected.affected_rows).toBe(3);
		expect(selected.rows).toEqual([
			{ id: 1, entry: "a" },
			{ id: 2, entry: "b" },
			{ id: 3, entry: "c" },
		]);
	});

	test.skipIf(!SQLITE_AVAILABLE)("a SQL error surfaces the database's own message", async () => {
		let error = unwrapError(
			await plugin.call("query", [value("SELECT * FROM does_not_exist")], context),
		);
		expect(error).toBeInstanceOf(ToolError);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("db.query failed");
		expect(error.message).toContain("does_not_exist");
	});

	test.skipIf(!SQLITE_AVAILABLE)(
		"reuses one connection across calls, closed by dispose",
		async () => {
			// The same handle serves every call in a run; after dispose it is gone,
			// and a fresh call would transparently reconnect. Two writes landing in
			// the same table is the observable proof the connection was reused.
			expectSuccess(
				await plugin.call(
					"query",
					[value("CREATE TABLE IF NOT EXISTS reuse (id INTEGER PRIMARY KEY)")],
					context,
				),
			);
			expectSuccess(
				await plugin.call("query", [value("INSERT INTO reuse DEFAULT VALUES")], context),
			);
			expectSuccess(
				await plugin.call("query", [value("INSERT INTO reuse DEFAULT VALUES")], context),
			);
			let counted = asObject(
				expectSuccess(await plugin.call("query", [value("SELECT id FROM reuse")], context)),
			);
			expect(counted.count).toBe(2);

			// dispose is idempotent and best-effort: calling it twice never throws.
			if (plugin.dispose !== undefined) {
				await plugin.dispose();
				await plugin.dispose();
			}
		},
	);
});
