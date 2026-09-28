/**
 * Vitest global setup for the sdxc project. It writes the catalogue documents before
 * any test file loads, because the services under test read them from `app/generated`
 * and that folder only exists once the extractor has run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The extractor, run as its own process so it resolves the app's aliases as `bun` does. */
const EXTRACTOR = join(dirname(fileURLToPath(import.meta.url)), "extract-catalogue.ts");

/** Regenerates the catalogues once per run; a failed extraction fails the run before any test. */
export default function setup(): void {
	execFileSync("bun", [EXTRACTOR], { stdio: "inherit" });
}
