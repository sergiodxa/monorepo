/**
 * Tests for the built-in `db` plugin. Unit tests exercise the descriptors,
 * argument validation, connection selection, and the grants each tool needs,
 * none of which reaches a database; end-to-end tests run the real query and
 * seeding lifecycle against a temp-file SQLite database via `db-e2e-probe.ts`,
 * spawned under Bun.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";
import { beforeAll, describe, expect, test } from "vitest";

import type { Connection } from "../bases.js";
import type { SpecError } from "../errors.js";
import type { Grant, Grants } from "../permissions.js";
import type { ToolContext } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { createConnectionSet } from "../bases.js";
import { PermissionDeniedError } from "../errors.js";
import { createPermissionSet } from "../permissions.js";
import { createToolContext } from "../tool-context.js";

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

/** The connection every allowed unit test selects, alone unless a case adds more. */
const WEB: Connection = { name: "web", url: "postgres://localhost/web" };

/** A second connection, so a case can exercise selection among several. */
const BACKEND: Connection = { name: "backend", url: "postgres://localhost/backend" };

/** Wrap a runtime value as a positional value argument. */
function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** Wrap a bare identifier as a word argument. */
function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** How one test's run was granted; anything omitted stays denied. */
interface Allowed {
	/** The database grant, denied unless the case sets it. */
	db?: Grant;
	/** The host filesystem grant, denied unless the case sets it. */
	hostFs?: Grant;
}

/** Build a grant set out of the two families the `db` tools consult. */
function grants(allowed: Allowed): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: allowed.hostFs ?? { mode: "denied" },
		db: allowed.db ?? { mode: "denied" },
	};
}

/**
 * Build a context for one call: the connections the run configured and the
 * grants it holds. The default is the single `web` connection, granted, which
 * is the shape every argument-validation case wants out of its way.
 */
function context(
	connections: Connection[] = [WEB],
	allowed: Allowed = { db: { mode: "all" }, hostFs: { mode: "all" } },
): ToolContext {
	return createToolContext({
		connections: createConnectionSet(connections),
		permissions: createPermissionSet(grants(allowed)),
	});
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

	/**
	 * Vitest runs under Node, where Bun's SQL client cannot be imported, so a
	 * call that clears every gate stops at the open. Reaching this message is
	 * how a unit test proves the grants and the connection both resolved.
	 */
	async function expectReachedTheDriver(args: ToolArg[], on: ToolContext): Promise<void> {
		let error = unwrapError(await plugin.call("query", args, on));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("could not open the connection");
	}

	test("describes a query and a run_file action, both requiring the db grant", () => {
		expect(plugin.namespace).toBe("db");
		let tools = plugin.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["query", "run_file"]);
		for (let tool of tools) {
			expect(tool.kind).toBe("action");
			expect(tool.requires).toBe("db");
		}
	});

	test("query declares the SQL value and its three option words", () => {
		let query = plugin.describe()[0];
		expect(query?.params.map((param) => [param.name, param.kind, param.required])).toEqual([
			["sql", "value", true],
			["params", "word", false],
			["on", "word", false],
			["one", "word", false],
		]);
	});

	test("run_file declares the path value and the connection word", () => {
		let runFile = plugin.describe()[1];
		expect(runFile?.params.map((param) => [param.name, param.kind, param.required])).toEqual([
			["path", "value", true],
			["on", "word", false],
		]);
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let error = unwrapError(await plugin.call("execute", [value("SELECT 1")], context()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('db has no tool named "execute"');
		expect(error.message).toContain("query");
		expect(error.message).toContain("run_file");
	});

	describe("query arguments", () => {
		test("rejects a missing SQL argument", async () => {
			let error = unwrapError(await plugin.call("query", [], context()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("requires the SQL text");
		});

		test("rejects a bare word in place of the SQL", async () => {
			let error = unwrapError(await plugin.call("query", [word("SELECT")], context()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("SQL string");
		});

		test("rejects a non-string SQL argument", async () => {
			let error = unwrapError(await plugin.call("query", [value(42)], context()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("SQL string");
		});

		test("rejects a second bare value, pointing at the option words", async () => {
			let error = unwrapError(
				await plugin.call("query", [value("SELECT 1"), value("SELECT 2")], context()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("params, on, one");
		});

		test("rejects an unknown option word", async () => {
			let error = unwrapError(
				await plugin.call("query", [value("SELECT 1"), word("into"), value("x")], context()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain('unknown option word "into"');
		});

		test("an option word with nothing after it is a usage error", async () => {
			let error = unwrapError(
				await plugin.call("query", [value("SELECT 1"), word("params")], context()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("needs a value argument after it");
		});

		test("a non-string connection name is a usage error", async () => {
			let error = unwrapError(
				await plugin.call("query", [value("SELECT 1"), word("on"), value(7)], context()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("connection name string");
		});

		test("two connection names are a usage error", async () => {
			let error = unwrapError(
				await plugin.call(
					"query",
					[value("SELECT 1"), word("on"), value("web"), word("on"), value("backend")],
					context([WEB, BACKEND]),
				),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("at most one connection name");
		});

		test("two params lists are a usage error", async () => {
			let error = unwrapError(
				await plugin.call(
					"query",
					[value("SELECT $1"), word("params"), value("a"), word("params"), value("b")],
					context(),
				),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("at most one params list");
		});

		/** Parameters bind by position, which an object has no ordering for. */
		test("an object params argument is a usage error", async () => {
			let error = unwrapError(
				await plugin.call(
					"query",
					[value("SELECT $1"), word("params"), value({ email: "a@b.c" })],
					context(),
				),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("one scalar or an array of them");
		});

		test("a scalar params argument reaches the driver", async () => {
			await expectReachedTheDriver([value("SELECT $1"), word("params"), value("a@b.c")], context());
		});

		test("an array params argument reaches the driver", async () => {
			await expectReachedTheDriver(
				[value("SELECT $1, $2"), word("params"), value([1, "two"])],
				context(),
			);
		});

		test("the words may be written in any order", async () => {
			await expectReachedTheDriver(
				[value("SELECT $1"), word("one"), word("on"), value("web"), word("params"), value(1)],
				context([WEB, BACKEND]),
			);
		});
	});

	describe("connection selection", () => {
		test("a lone connection needs no name", async () => {
			await expectReachedTheDriver([value("SELECT 1")], context());
		});

		test("several connections make an unnamed query ask for a name", async () => {
			let error = unwrapError(
				await plugin.call("query", [value("SELECT 1")], context([WEB, BACKEND])),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain('on "web"');
			expect(error.message).toContain('"backend"');
		});

		test("a name no connection carries lists the configured ones", async () => {
			let error = unwrapError(
				await plugin.call(
					"query",
					[value("SELECT 1"), word("on"), value("ledger")],
					context([WEB, BACKEND]),
				),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain('No database connection named "ledger"');
			expect(error.message).toContain('"web", "backend"');
		});

		test("a run that configured no connection says so", async () => {
			let error = unwrapError(await plugin.call("query", [value("SELECT 1")], context([])));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("spec/config.jsonc");
		});
	});

	describe("grants", () => {
		test("query denied outright names the flag scoped to the connection", async () => {
			let error = unwrapError(await plugin.call("query", [value("SELECT 1")], context([WEB], {})));
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect((error as PermissionDeniedError).permission).toBe("db");
			expect((error as PermissionDeniedError).resource).toBe("web");
			expect(error.remedy).toBe("spec run --allow-db=web");
		});

		/** A grant covering one connection leaves the other one denied by name. */
		test("query names the connection a scoped grant left out", async () => {
			let error = unwrapError(
				await plugin.call(
					"query",
					[value("SELECT 1"), word("on"), value("backend")],
					context([WEB, BACKEND], { db: { mode: "scoped", scopes: ["web"] } }),
				),
			);
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect(error.remedy).toBe("spec run --allow-db=backend");
		});

		test("run_file missing both grants names both flags in one denial", async () => {
			let error = unwrapError(
				await plugin.call("run_file", [value("db/seed.sql")], context([WEB], {})),
			);
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect(error.remedy).toContain("--allow-db=web");
			expect(error.remedy).toContain("--allow-host-fs=");
		});

		test("run_file with the database granted still asks for the file", async () => {
			let error = unwrapError(
				await plugin.call(
					"run_file",
					[value("db/seed.sql")],
					context([WEB], { db: { mode: "all" } }),
				),
			);
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect((error as PermissionDeniedError).permission).toBe("host-fs");
			expect(error.remedy).toContain("--allow-host-fs=");
		});

		test("run_file with the file granted still asks for the database", async () => {
			let error = unwrapError(
				await plugin.call(
					"run_file",
					[value("db/seed.sql")],
					context([WEB], { hostFs: { mode: "all" } }),
				),
			);
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect((error as PermissionDeniedError).permission).toBe("db");
			expect(error.remedy).toBe("spec run --allow-db=web");
		});
	});

	describe("run_file arguments", () => {
		test("rejects a missing path", async () => {
			let error = unwrapError(await plugin.call("run_file", [], context()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("requires the path of a SQL file");
		});

		test("rejects a non-string path", async () => {
			let error = unwrapError(await plugin.call("run_file", [value(7)], context()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("path string");
		});

		test("rejects anything after the path that is not a connection", async () => {
			let error = unwrapError(
				await plugin.call("run_file", [value("db/seed.sql"), value("web")], context()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain('on "name"');
		});

		/**
		 * The path resolves against the working directory and is read before any
		 * connection opens, so a missing file reports the path it looked at.
		 */
		test("a missing file reports the path it resolved against the working directory", async () => {
			let error = unwrapError(
				await plugin.call("run_file", [value("db/absent-seed.sql")], context()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("could not read");
			expect(error.message).toContain(join(process.cwd(), "db", "absent-seed.sql"));
		});
	});

	test("dispose is safe with nothing opened, and repeatable", async () => {
		let idle = createDbPlugin();
		await expect(idle.dispose?.()).resolves.toBeUndefined();
		await expect(idle.dispose?.()).resolves.toBeUndefined();
	});
});

/** What `db-e2e-probe.ts` reports back, one field per expectation below. */
interface ProbeObservations {
	created: { rows: unknown; count: unknown };
	inserted: { rows: unknown; count: unknown; affected_rows: unknown };
	insertedMany: { affected_rows: unknown };
	selected: { rows: unknown; count: unknown; affected_rows: unknown };
	parameterized: { rows: unknown; count: unknown };
	one: unknown;
	oneOfMany: { isToolError: boolean; message: string };
	oneOfNone: { isToolError: boolean; message: string };
	seeded: { affected_rows: unknown };
	seededRows: { count: unknown };
	secondConnection: { rows: unknown };
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
	let stamp = `${process.pid}-${Date.now()}`;
	let paths = [
		join(tmpdir(), `spec-db-e2e-${stamp}.sqlite`),
		join(tmpdir(), `spec-db-e2e-${stamp}-other.sqlite`),
	];

	beforeAll(() => {
		if (!SQLITE_AVAILABLE) return;
		try {
			let stdout = execFileSync(
				BUN_EXECUTABLE,
				[join(import.meta.dirname, "db-e2e-probe.ts"), ...paths],
				{ encoding: "utf8", timeout: PROBE_TIMEOUT_MS },
			);
			observed = JSON.parse(stdout) as ProbeObservations;
		} finally {
			/** SQLite may leave a WAL/SHM sidecar; remove all three, ignore misses. */
			for (let path of paths) {
				for (let suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
			}
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

	test.skipIf(!SQLITE_AVAILABLE)("binds params positionally", () => {
		expect(observed.parameterized.count).toBe(1);
		expect(observed.parameterized.rows).toEqual([{ id: 2, entry: "b" }]);
	});

	/**
	 * `one` unwraps the row so a caller reads `fund.id` rather than
	 * `fund.rows.0.id`, and refuses every count that is not exactly one.
	 */
	test.skipIf(!SQLITE_AVAILABLE)("one returns the row itself, or refuses the count", () => {
		expect(observed.one).toEqual({ id: 1, entry: "a" });

		expect(observed.oneOfMany.isToolError).toBe(true);
		expect(observed.oneOfMany.message).toContain("asked for one row and got 3");

		expect(observed.oneOfNone.isToolError).toBe(true);
		expect(observed.oneOfNone.message).toContain("asked for one row and got 0");
	});

	/**
	 * The file goes over unsplit, so its four statements — one of which quotes a
	 * semicolon a splitter would have cut on — all land from the one call.
	 */
	test.skipIf(!SQLITE_AVAILABLE)("run_file applies every statement in the file", () => {
		expect(observed.seeded.affected_rows).toBe(2);
		expect(observed.seededRows.count).toBe(2);
	});

	test.skipIf(!SQLITE_AVAILABLE)("on selects among several configured connections", () => {
		expect(observed.secondConnection.rows).toEqual([{ note: "elsewhere" }]);
	});

	test.skipIf(!SQLITE_AVAILABLE)("a SQL error surfaces the database's own message", () => {
		expect(observed.sqlError.isToolError).toBe(true);
		expect(observed.sqlError.code).toBe("tool-error");
		expect(observed.sqlError.message).toContain("db.query failed");
		expect(observed.sqlError.message).toContain("does_not_exist");
	});

	/**
	 * The same handle serves every call on a name, so two writes landing in
	 * the same table is the observable proof of reuse; dispose is
	 * idempotent and best-effort, so calling it twice never throws.
	 */
	test.skipIf(!SQLITE_AVAILABLE)("reuses one connection across calls, closed by dispose", () => {
		expect(observed.reuse.count).toBe(2);
		expect(observed.reuse.disposeThrew).toBe(false);
	});
});
