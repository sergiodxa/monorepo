/**
 * Runs the functional `db` examples (`packages/spec/examples/db/`) through the
 * real `spec` CLI as a child process, against two temp-file SQLite databases.
 * This is the connecting acceptance layer the CI-safe `spec/db.spec` meta-tests
 * cannot be: it demonstrates the whole operator-side form — DSNs supplied to
 * `examples/db/config.jsonc` through the environment, `--allow-db` scoped to
 * the connection names, and `--allow-host-fs` for the seed file `db.run_file`
 * reads. It runs whenever Bun's SQL client has a SQLite driver (so it needs no
 * external server) and skips only when SQLite is unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "vitest";

/** Absolute path of this package, the example run's working directory. */
const PACKAGE_DIR = resolve(import.meta.dirname, "..");

/** The example suite, as `spec run` is pointed at it and as paths in it read. */
const SUITE_DIR = join("examples", "db");

/**
 * The Bun executable, found on PATH. The CLI under test is a Bun program, so it
 * is spawned by name rather than through the running runtime's own executable.
 */
const BUN_EXECUTABLE = "bun";

/**
 * Whether Bun's SQL client exposes SQLite; the examples run against it. The
 * probe runs inside Bun rather than in this process, because the SQL client
 * belongs to the runtime the child CLI executes under, not to this file's.
 */
const SQLITE_AVAILABLE =
	spawnSync(
		BUN_EXECUTABLE,
		["-e", 'import { SQL } from "bun"; process.stdout.write(String("SQLiteError" in SQL));'],
		{ encoding: "utf8" },
	).stdout?.trim() === "true";

/** How long the example run may take: it spawns one CLI and touches SQLite. */
const EXAMPLE_TIMEOUT_MS = 60_000;

test.skipIf(!SQLITE_AVAILABLE)(
	"the examples/db suite passes through the real CLI against SQLite databases",
	async () => {
		let stamp = `${process.pid}-${Date.now()}`;
		let paths = {
			web: join(tmpdir(), `spec-db-example-${stamp}-web.sqlite`),
			backend: join(tmpdir(), `spec-db-example-${stamp}-backend.sqlite`),
		};
		try {
			let child = spawn(
				BUN_EXECUTABLE,
				[
					join(PACKAGE_DIR, "src", "cli.ts"),
					"run",
					SUITE_DIR,
					"--allow-db=web,backend",
					`--allow-host-fs=${join(PACKAGE_DIR, SUITE_DIR)}`,
				],
				{
					cwd: PACKAGE_DIR,
					env: {
						...process.env,
						WEB_DATABASE_URL: `sqlite://${paths.web}`,
						BACKEND_DATABASE_URL: `sqlite://${paths.backend}`,
					},
					stdio: ["ignore", "pipe", "pipe"],
				},
			);
			let stdout = "";
			let stderr = "";
			child.stdout?.setEncoding("utf8");
			child.stderr?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => void (stdout += chunk));
			child.stderr?.on("data", (chunk: string) => void (stderr += chunk));
			let exitCode = await new Promise<number>((settle, reject) => {
				child.once("error", reject);
				child.once("close", (code: number | null) => settle(code ?? 1));
			});
			let report = `db example CLI output:\n${stdout}${stderr}`;

			expect(exitCode, report).toBe(0);
			expect(stdout, report).not.toContain("✗");
			let summary = /(\d+) passed, (\d+) failed/.exec(stdout);
			expect(summary, report).not.toBeNull();
			expect(Number(summary?.[1]), report).toBeGreaterThan(0);
			expect(Number(summary?.[2]), report).toBe(0);
		} finally {
			for (let path of Object.values(paths)) {
				for (let suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
			}
		}
	},
	EXAMPLE_TIMEOUT_MS,
);
