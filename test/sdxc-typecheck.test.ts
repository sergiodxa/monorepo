/**
 * Type checks the `sdxc` umbrella as a consumer's project would: it re-exports every package,
 * so the compiler reaches each one's source without that package's own tsconfig, and a package
 * leaning on a global its tsconfig loads (a Workers binding type) fails here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "vite-plus/test";

/** Repo root, resolved from this file so the check targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

test("every package type checks from the sdxc umbrella's project", () => {
	let compiler = spawnSync(
		process.execPath,
		[join(ROOT, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", join(ROOT, "packages/sdxc")],
		{ cwd: ROOT, encoding: "utf8" },
	);

	expect(compiler.stdout + compiler.stderr).toBe("");
	expect(compiler.status).toBe(0);
}, 120_000);
