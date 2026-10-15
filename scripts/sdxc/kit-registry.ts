/**
 * Writes the `sdxc ui` component registry into `packages/kit`, so a kit run from this working
 * copy reads `@sdxc/ui` as it is checked out. The release build writes the same files into the
 * published kit; this copy is git-ignored and regenerated on demand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure } from "@sdxc/result";

import { UI_REGISTRY_DIR, writeUIRegistry } from "../release/ui-registry.js";

/** Repo root, resolved from this file so the script works from any cwd. */
const ROOT = join(import.meta.dirname, "../..");

/** The kit package whose registry folder this writes. */
const KIT_DIR = join(ROOT, "packages/kit");

let manifest = JSON.parse(await readFile(join(KIT_DIR, "package.json"), "utf8")) as {
	version: string;
};
let written = await writeUIRegistry(KIT_DIR, { root: ROOT, version: manifest.version });
if (isFailure(written)) {
	process.stderr.write(`${written.error.message}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(`Wrote the component registry to packages/kit/${UI_REGISTRY_DIR}.\n`);
}
