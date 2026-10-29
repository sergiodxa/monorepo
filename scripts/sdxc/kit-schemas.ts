/**
 * Renders `@sdxc/kit`'s `config.schema.json` and `lock.schema.json` from the schemas the
 * command line validates with, so editors and the CLI share one definition, and reports when
 * the committed files drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { Result } from "@sdxc/result";

import { isFailure, success, wrap } from "@sdxc/result";

import { configJSONSchema } from "../../packages/kit/src/config.js";
import { lockJSONSchema } from "../../packages/kit/src/lock.js";

/** The kit's directory under `packages/`, the package that owns the command line's schemas. */
export const KIT_DIR = "kit";

/** The command that rewrites the kit schemas, as every generated header and failure names it. */
export const GENERATE_COMMAND = "bun run sdxc:generate";

/**
 * The kit's JSON Schema documents, keyed by path relative to `packages/kit`, each rendered from
 * the schema the command line validates with, so editors and the CLI read one definition.
 */
export function generateKitSchemas(): Result<Map<string, string>, Error> {
	let config = configJSONSchema();
	if (isFailure(config)) return config;
	let lock = lockJSONSchema();
	if (isFailure(lock)) return lock;
	return success(
		new Map([
			["config.schema.json", `${JSON.stringify(config.data, null, "\t")}\n`],
			["lock.schema.json", `${JSON.stringify(lock.data, null, "\t")}\n`],
		]),
	);
}

/**
 * Every way the committed kit schemas under `packages/kit` differ from what `generateKitSchemas`
 * produces for the workspace at `root`, one sorted line per file, so the drift test names exactly
 * what a regeneration would change.
 */
export async function kitSchemaDrift(root: string): Promise<Result<string[], Error>> {
	let schemas = generateKitSchemas();
	if (isFailure(schemas)) return schemas;
	let problems: string[] = [];
	for (let [path, expected] of schemas.data) {
		let committed = await wrap(() => readFile(join(root, "packages", KIT_DIR, path), "utf8"));
		if (isFailure(committed)) problems.push(`${KIT_DIR}/${path} is missing`);
		else if (!isDeepStrictEqual(JSON.parse(committed.data), JSON.parse(expected))) {
			problems.push(`${KIT_DIR}/${path} is out of date`);
		}
	}
	return success(problems.sort());
}
