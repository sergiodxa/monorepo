/**
 * Guards the committed `sdxc` umbrella against the workspace it re-exports: a new package or
 * subpath, a removed one, a wildcard file added or deleted, or a configuration key changed all
 * fail here until the regeneration is committed. Its binary runs the kit's command line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { expect, test } from "vite-plus/test";

import { GENERATE_COMMAND, umbrellaDrift } from "../scripts/sdxc/umbrella.js";

/** Repo root, resolved from this file so the check targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

test("the committed sdxc umbrella matches what the workspace generates", async () => {
	let problems = unwrap(await umbrellaDrift(ROOT));

	expect(problems, `run \`${GENERATE_COMMAND}\` and commit the result`).toEqual([]);
});

test("the umbrella's sdxc binary runs the kit's command line at the kit's version", () => {
	let run = (argv: string[]) =>
		spawnSync("bun", [join(ROOT, "packages/sdxc/src/sdxc.ts"), ...argv], {
			cwd: ROOT,
			encoding: "utf8",
		});

	let version = run(["--version"]);
	let help = run(["--help"]);

	expect(version.stdout).toBe("0.0.1\n");
	expect(help.status).toBe(0);
	expect(help.stdout).toContain("upgrade");
});
