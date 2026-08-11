/**
 * Runs the dogfood suite — the `.spec` files under `packages/spec/spec/` that
 * specify the spec CLI itself — through the compiled binary as a child process,
 * so `bun test` covers the acceptance layer against the shipped artifact, not a
 * per-launch `bun cli.ts` transpile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Absolute path of this package, the dogfood run's working directory. */
const PACKAGE_DIR = resolve(import.meta.dir, "..");

/** The CLI source entry compiled into the standalone binary. */
const CLI_ENTRY = join(PACKAGE_DIR, "src", "cli.ts");

/** Where `bun build --compile` writes the binary (gitignored `bin/`). */
const BINARY_PATH = join(PACKAGE_DIR, "bin", "spec");

/** How long the whole dogfood run may take: it compiles then spawns one CLI per test. */
const DOGFOOD_TIMEOUT_MS = 120_000;

test(
	"the dogfood suite passes through the compiled binary",
	async () => {
		// Compile the standalone binary from the current source so the run
		// exercises the shipped artifact. Building fresh (rather than reusing a
		// stale `bin/spec`) keeps this acceptance test honest to whatever source
		// `bun test` is checking — the compile costs ~100ms, negligible next to
		// the suite it enables.
		let build = Bun.spawn({
			cmd: [process.execPath, "build", CLI_ENTRY, "--compile", "--outfile", BINARY_PATH],
			cwd: PACKAGE_DIR,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		let buildLog = await new Response(build.stderr).text();
		expect(await build.exited, `spec binary build failed:\n${buildLog}`).toBe(0);

		// The suite's meta-tests spawn `spec` by name, so put a `spec` symlink to
		// the freshly compiled binary on PATH: every layer of the run — the outer
		// runner and each spawned child — is the fast compiled binary.
		let pathDir = mkdtempSync(join(tmpdir(), "spec-dogfood-"));
		symlinkSync(BINARY_PATH, join(pathDir, "spec"));
		try {
			let child = Bun.spawn({
				cmd: [
					BINARY_PATH,
					"run",
					"spec",
					"--allow-run=spec,echo",
					// spec/env.spec reads one real variable through `env.get`, and
					// `cli.run` forwards only granted names into its children — so the
					// value has to be both defined here and granted by name here.
					"--allow-env=SPEC_ENV_FIXTURE",
				],
				cwd: PACKAGE_DIR,
				env: {
					...process.env,
					PATH: `${pathDir}:${process.env.PATH ?? ""}`,
					SPEC_ENV_FIXTURE: "fixture-value",
				},
				stdin: "ignore",
				stdout: "pipe",
				stderr: "pipe",
			});
			let [stdout, stderr, exitCode] = await Promise.all([
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
				child.exited,
			]);
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
