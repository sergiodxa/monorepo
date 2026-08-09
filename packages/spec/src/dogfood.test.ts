/**
 * Runs the dogfood suite — the `.spec` files under `packages/spec/spec/` that
 * specify the spec CLI itself — through the real CLI as a child process, so
 * `bun test` covers the acceptance layer alongside the unit tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Absolute path of this package, the dogfood run's working directory. */
const PACKAGE_DIR = resolve(import.meta.dir, "..");

/** Absolute path of the repository root, where `node_modules` lives. */
const REPO_ROOT = resolve(PACKAGE_DIR, "../..");

/** The directory that must expose a `spec` executable to the dogfood tests. */
const BIN_DIR = join(REPO_ROOT, "node_modules", ".bin");

/** How long the whole dogfood run may take: it spawns one CLI per test. */
const DOGFOOD_TIMEOUT_MS = 120_000;

/**
 * Guarantee a `spec` executable in the repo's bin directory. Workspace bin
 * linking creates it on a fresh install; when the link is absent (installs
 * predating the package), generate an equivalent shim. The shim is a build
 * artifact of this test, never committed.
 */
function ensureSpecOnPath(): void {
	let shim = join(BIN_DIR, "spec");
	if (existsSync(shim)) return;
	mkdirSync(BIN_DIR, { recursive: true });
	let cli = join(PACKAGE_DIR, "src", "cli.ts");
	writeFileSync(shim, `#!/bin/sh\nexec bun "${cli}" "$@"\n`, "utf8");
	chmodSync(shim, 0o755);
}

test(
	"the dogfood suite passes through the real CLI",
	async () => {
		ensureSpecOnPath();
		let child = Bun.spawn({
			cmd: [
				process.execPath,
				join(PACKAGE_DIR, "src", "cli.ts"),
				"run",
				"spec",
				"--allow-run=spec,echo",
			],
			cwd: PACKAGE_DIR,
			env: { ...process.env, PATH: `${BIN_DIR}:${process.env.PATH ?? ""}` },
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
	},
	DOGFOOD_TIMEOUT_MS,
);
