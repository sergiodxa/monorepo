/**
 * Runs the dogfood suite — the `.spec` files under `packages/spec/spec/` that
 * specify the spec CLI itself — through the compiled binary as a child process,
 * so the test suite covers the acceptance layer against the shipped artifact,
 * not a per-launch `bun cli.ts` transpile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "vitest";

/** Absolute path of this package, the dogfood run's working directory. */
const PACKAGE_DIR = resolve(import.meta.dirname, "..");

/** The CLI source entry compiled into the standalone binary. */
const CLI_ENTRY = join(PACKAGE_DIR, "src", "cli.ts");

/** Where `bun build --compile` writes the binary (gitignored `bin/`). */
const BINARY_PATH = join(PACKAGE_DIR, "bin", "spec");

/** How long the whole dogfood run may take: it compiles then spawns one CLI per test. */
const DOGFOOD_TIMEOUT_MS = 120_000;

/**
 * The Bun executable, found on PATH. Only Bun can compile the standalone
 * binary, so the build is spawned by name rather than through the running
 * runtime's own executable.
 */
const BUN_EXECUTABLE = "bun";

test(
	"the dogfood suite passes through the compiled binary",
	async () => {
		// Compile the standalone binary from the current source so the run
		// exercises the shipped artifact. Building fresh (rather than reusing a
		// stale `bin/spec`) keeps this acceptance test honest to whatever source
		// the suite is checking — the compile costs ~100ms, negligible next to
		// the suite it enables.
		let build = spawn(BUN_EXECUTABLE, ["build", CLI_ENTRY, "--compile", "--outfile", BINARY_PATH], {
			cwd: PACKAGE_DIR,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let buildLog = "";
		build.stderr?.setEncoding("utf8");
		build.stderr?.on("data", (chunk: string) => void (buildLog += chunk));
		let buildCode = await new Promise<number>((settle, reject) => {
			build.once("error", reject);
			build.once("close", (code: number | null) => settle(code ?? 1));
		});
		expect(buildCode, `spec binary build failed:\n${buildLog}`).toBe(0);

		// The suite's meta-tests spawn `spec` by name, so put a `spec` symlink to
		// the freshly compiled binary on PATH: every layer of the run — the outer
		// runner and each spawned child — is the fast compiled binary.
		let pathDir = mkdtempSync(join(tmpdir(), "spec-dogfood-"));
		symlinkSync(BINARY_PATH, join(pathDir, "spec"));
		try {
			let child = spawn(
				BINARY_PATH,
				[
					"run",
					"spec",
					"--allow-run=spec,echo",
					// spec/env.spec reads one real variable through `env.get`, and
					// `cli.run` forwards only granted names into its children — so the
					// value has to be both defined here and granted by name here.
					"--allow-env=SPEC_ENV_FIXTURE",
				],
				{
					cwd: PACKAGE_DIR,
					env: {
						...process.env,
						PATH: `${pathDir}:${process.env.PATH ?? ""}`,
						SPEC_ENV_FIXTURE: "fixture-value",
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
			let report = `dogfood CLI output:\n${stdout}${stderr}`;

			expect(exitCode, report).toBe(0);
			expect(stdout, report).not.toContain("✗");
			let summary = /(\d+) passed, (\d+) failed/.exec(stdout);
			expect(summary, report).not.toBeNull();
			expect(Number(summary?.[1]), report).toBeGreaterThan(0);
			expect(Number(summary?.[2]), report).toBe(0);
		} finally {
			rmSync(pathDir, { recursive: true, force: true });
		}
	},
	DOGFOOD_TIMEOUT_MS,
);
