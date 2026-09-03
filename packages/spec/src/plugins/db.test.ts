/**
 * Tests for the built-in `db` plugin. Unit tests exercise the descriptor,
 * argument validation, and permission checks without opening a connection;
 * end-to-end tests run the real query lifecycle against a temp-file SQLite
 * database via `db-e2e-probe.ts`, spawned under Bun.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { beforeAll, describe, expect, test } from "vitest";

import type { SpecError } from "../errors.js";
import type { PermissionSet } from "../permissions.js";
import type { ToolContext } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";
import type { Workspace } from "../workspace.js";

import { PermissionDeniedError } from "../errors.js";

import { createDbPlugin } from "./db.js";

/**
 * The Bun executable, found on PATH. The end-to-end half spawns Bun
 * directly, since the code under test depends on Bun's SQL client.
 */
const BUN_EXECUTABLE = "bun";

/**
 * Whether Bun's SQL client exposes SQLite; gates the end-to-end suite. The
 * probe runs inside Bun because the SQL client belongs to the runtime the
 * child executes under.
 */
const SQLITE_AVAILABLE =
	spawnSync(
		BUN_EXECUTABLE,
		["-e", 'import { SQL } from "bun"; process.stdout.write(String("SQLiteError" in SQL));'],
		{ encoding: "utf8" },
	).stdout?.trim() === "true";

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
	return {
		workspace: stubWorkspace(),
		permissions,
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
	};
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
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

	/**
	 * DATABASE_URL is unset, so the call stops at the configuration error; the
	 * scoped permission check is still the one that ran, by name.
	 */
	test("query asks the permission set about DATABASE_URL by name", async () => {
		let envCalls: string[] = [];
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

/** What `db-e2e-probe.ts` reports back, one field per expectation below. */
interface ProbeObservations {
	created: { rows: unknown; count: unknown };
	inserted: { rows: unknown; count: unknown; affected_rows: unknown };
	insertedMany: { affected_rows: unknown };
	selected: { rows: unknown; count: unknown; affected_rows: unknown };
	sqlError: { isToolError: boolean; code: string; message: string };
	reuse: { count: unknown; disposeThrew: boolean };
}

/** How long the probe may take: it spawns Bun and touches SQLite. */
const PROBE_TIMEOUT_MS = 60_000;

/**
 * Skipped when Bun's SQL client has no SQLite driver, so the unit suite
 * stays green regardless.
 */
describe("db end to end (SQLite)", () => {
	let observed: ProbeObservations;
	let dbPath = join(tmpdir(), `spec-db-e2e-${process.pid}-${Date.now()}.sqlite`);

	beforeAll(() => {
		if (!SQLITE_AVAILABLE) return;
		try {
			let stdout = execFileSync(
				BUN_EXECUTABLE,
				[join(import.meta.dirname, "db-e2e-probe.ts"), dbPath],
				{ encoding: "utf8", timeout: PROBE_TIMEOUT_MS },
			);
			observed = JSON.parse(stdout) as ProbeObservations;
		} finally {
			/** SQLite may leave a WAL/SHM sidecar; remove all three, ignore misses. */
			for (let suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
		}
	}, PROBE_TIMEOUT_MS);

	/**
	 * An INSERT reports the rows it changed as affected_rows, with no rows
	 * returned; a SELECT returns rows, with affected_rows and count both
	 * equal to the row count.
	 */
	test.skipIf(!SQLITE_AVAILABLE)("shapes DDL, DML and SELECT results", () => {
		expect(observed.created.rows).toEqual([]);
		expect(observed.created.count).toBe(0);

		expect(observed.inserted.affected_rows).toBe(1);
		expect(observed.inserted.count).toBe(0);
		expect(observed.inserted.rows).toEqual([]);
		expect(observed.insertedMany.affected_rows).toBe(2);

		expect(observed.selected.count).toBe(3);
		expect(observed.selected.affected_rows).toBe(3);
		expect(observed.selected.rows).toEqual([
			{ id: 1, entry: "a" },
			{ id: 2, entry: "b" },
			{ id: 3, entry: "c" },
		]);
	});

	test.skipIf(!SQLITE_AVAILABLE)("a SQL error surfaces the database's own message", () => {
		expect(observed.sqlError.isToolError).toBe(true);
		expect(observed.sqlError.code).toBe("tool-error");
		expect(observed.sqlError.message).toContain("db.query failed");
		expect(observed.sqlError.message).toContain("does_not_exist");
	});

	/**
	 * The same handle serves every call in a run, so two writes landing in
	 * the same table is the observable proof of reuse; dispose is
	 * idempotent and best-effort, so calling it twice never throws.
	 */
	test.skipIf(!SQLITE_AVAILABLE)("reuses one connection across calls, closed by dispose", () => {
		expect(observed.reuse.count).toBe(2);
		expect(observed.reuse.disposeThrew).toBe(false);
	});
});
