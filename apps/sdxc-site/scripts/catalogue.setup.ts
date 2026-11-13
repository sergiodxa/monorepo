/**
 * Vitest global setup for the sdxc projects. It writes the catalogue documents and Delta's
 * source and history before any test file loads, because the services under test read them
 * from `resources/generated` and that folder only exists once the extractors have run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The scripts folder the extractors live in. */
const SCRIPTS = dirname(fileURLToPath(import.meta.url));

/**
 * The extractors, each run as its own process so it resolves the app's aliases as `bun`
 * does, in the order `dev` and `build` run them.
 */
const EXTRACTORS = ["extract-catalogue.ts", "extract-delta.ts"].map((name) => join(SCRIPTS, name));

/** Regenerates every document once per run; a failed extraction fails the run before any test. */
export default function setup(): void {
	for (let extractor of EXTRACTORS) execFileSync("bun", [extractor], { stdio: "inherit" });
}
