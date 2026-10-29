#!/usr/bin/env bun
/**
 * `bun run sdxc:generate`: rewrites `@sdxc/kit`'s `config.schema.json` and `lock.schema.json`
 * from the schemas the command line validates with. Re-run it after changing a configuration
 * or lock key; the drift test fails until the regeneration is committed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, match, success, wrap } from "@sdxc/result";

import { REPO_ROOT } from "../release/workspace.js";

import { GENERATE_COMMAND, KIT_DIR, generateKitSchemas } from "./kit-schemas.js";

/**
 * Writes the kit's schemas and answers a one-line summary of how many files changed.
 */
async function main(): Promise<Result<string, Error>> {
	let schemas = generateKitSchemas();
	if (isFailure(schemas)) return schemas;
	let kitDir = join(REPO_ROOT, "packages", KIT_DIR);
	let schemasWritten = await wrap(async () => {
		for (let [path, content] of schemas.data) await writeFile(join(kitDir, path), content);
	});
	if (isFailure(schemasWritten)) return schemasWritten;
	let formatted = spawnSync(
		"bunx",
		["vp", "fmt", ...[...schemas.data.keys()].map((path) => `packages/${KIT_DIR}/${path}`)],
		{ cwd: REPO_ROOT, stdio: "inherit" },
	);
	if (formatted.status !== 0) return failure(new Error("vp fmt failed on the generated JSON"));
	return success(`Wrote ${schemas.data.size} kit schema files via \`${GENERATE_COMMAND}\`.`);
}

match(await main(), {
	success: (report) => {
		process.stdout.write(`${report}\n`);
	},
	failure: (error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	},
});
