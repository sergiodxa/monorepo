/**
 * Rewrites the command reference in `packages/kit/README.md` from the `sdxc` contract and
 * formats the README, so the section reads as `sdxc <command> --help` does. The kit's
 * reference test fails until this runs after a command, argument or flag changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createSDXC } from "../../packages/kit/src/cli.js";
import { renderReference, replaceReference } from "../../packages/kit/src/reference.js";

/** Repo root, resolved from this file so the script works from any cwd. */
const ROOT = join(import.meta.dirname, "../..");

/** The README whose reference section this rewrites. */
const README = join(ROOT, "packages/kit/README.md");

let readme = await readFile(README, "utf8");
let rewritten = replaceReference(readme, renderReference(createSDXC().describe()!));
if (rewritten === null) {
	process.stderr.write(
		"packages/kit/README.md has no #### `sdxc … heading or ### Configuration.\n",
	);
	process.exitCode = 1;
} else {
	await writeFile(README, rewritten);
	let format = Bun.spawnSync(["bunx", "vp", "fmt", "packages/kit/README.md"], {
		cwd: ROOT,
		stdout: "inherit",
		stderr: "inherit",
	});
	process.exitCode = format.exitCode;
	if (format.exitCode === 0) {
		process.stdout.write("Rewrote the command reference in packages/kit/README.md.\n");
	}
}
