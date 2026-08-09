/**
 * Runs the functional `db` examples (`packages/spec/examples/db/`) through the
 * real `spec` CLI as a child process, against a temp-file SQLite database. This
 * is the connecting acceptance layer the CI-safe `spec/db.spec` meta-tests
 * cannot be: it demonstrates the per-call `DATABASE_URL=… spec run
 * --allow-env=DATABASE_URL` form by placing the connection string in the
 * child's environment and granting exactly that variable. It runs whenever
 * Bun's SQL client has a SQLite driver (so it needs no external server) and
 * skips only when SQLite is unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { SQL } from "bun";

/** Absolute path of this package, the example run's working directory. */
const PACKAGE_DIR = resolve(import.meta.dir, "..");

/** Whether Bun's SQL client exposes SQLite; the examples run against it. */
const SQLITE_AVAILABLE = "SQLiteError" in SQL;

/** How long the example run may take: it spawns one CLI and touches SQLite. */
const EXAMPLE_TIMEOUT_MS = 60_000;

test.skipIf(!SQLITE_AVAILABLE)(
	"the examples/db suite passes through the real CLI against a SQLite database",
	async () => {
		let dbPath = join(tmpdir(), `spec-db-example-${process.pid}-${Date.now()}.sqlite`);
		try {
			let child = Bun.spawn({
				cmd: [
					process.execPath,
					join(PACKAGE_DIR, "src", "cli.ts"),
					"run",
					"examples/db",
					"--allow-env=DATABASE_URL",
				],
				cwd: PACKAGE_DIR,
				// The per-call form: the connection string lives in the child's
				// environment, and the run is granted exactly that one variable.
				env: { ...process.env, DATABASE_URL: `sqlite://${dbPath}` },
				stdin: "ignore",
				stdout: "pipe",
				stderr: "pipe",
			});
			let [stdout, stderr, exitCode] = await Promise.all([
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
				child.exited,
			]);
			let report = `db example CLI output:\n${stdout}${stderr}`;

			expect(exitCode, report).toBe(0);
			expect(stdout, report).not.toContain("✗");
			let summary = /(\d+) passed, (\d+) failed/.exec(stdout);
			expect(summary, report).not.toBeNull();
			expect(Number(summary?.[1]), report).toBeGreaterThan(0);
			expect(Number(summary?.[2]), report).toBe(0);
		} finally {
			// SQLite may leave a WAL/SHM sidecar; remove all three, ignore misses.
			for (let suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
		}
	},
	EXAMPLE_TIMEOUT_MS,
);
