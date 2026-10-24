/**
 * Writes `schema.json` from the package's schema, so the static document a tool references
 * by URL stays the one the validator enforces. Run `bun run schema` after changing the
 * schema; the package's tests fail until the file matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { join } from "node:path";

import { isFailure } from "@sdxc/result";
import { $ } from "bun";

import { schemaDocument } from "../src/document.js";

const OUTPUT_PATH = join(import.meta.dir, "..", "schema.json");

const DOCUMENT = schemaDocument();

if (isFailure(DOCUMENT)) {
	process.stderr.write(`${DOCUMENT.error.message}\n`);
	process.exitCode = 1;
} else {
	await Bun.write(OUTPUT_PATH, `${JSON.stringify(DOCUMENT.data, null, "\t")}\n`);
	await $`bunx vp fmt ${OUTPUT_PATH}`.quiet();
	process.stdout.write(`Wrote ${OUTPUT_PATH}\n`);
}
