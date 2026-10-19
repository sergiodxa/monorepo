/**
 * The `typegen` check: the Worker's generated `env` types are newer than every file they are
 * generated from. `sdxc run typegen` writes them from `cloudflare.config.ts` and `.dev.vars`, so
 * a binding added since types as missing until it runs again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { CONFIG_FILE, ENV_EXAMPLE_FILE } from "./env.js";

/** Where `sdxc run typegen` writes the Worker's types, the file the app's tsconfig includes. */
export const TYPES_FILE = ".cloudflare/types/index.d.ts";

/** The files the types are generated from: the config, and the local and committed variables. */
const SOURCES = [CONFIG_FILE, ".dev.vars", ENV_EXAMPLE_FILE];

/** The command that regenerates the types. */
const FIX = "sdxc run typegen";

/** Warns when the types were never generated, or when a source file changed after they were. */
export const typegenCheck: Check = {
	name: "typegen",
	async run(context): Promise<CheckResult> {
		let config = await modified(context.root, CONFIG_FILE);
		if (config === null) return skipped(`No ${CONFIG_FILE} in the project`);
		let types = await modified(context.root, TYPES_FILE);
		if (types === null) {
			return {
				status: "warn",
				message: `The Worker's env types were never generated; ${TYPES_FILE} is missing`,
				findings: [],
				fix: FIX,
			};
		}
		let newer: string[] = [];
		for (let source of SOURCES) {
			let time = await modified(context.root, source);
			if (time !== null && time > types)
				newer.push(`${source} changed after the types were generated`);
		}
		if (newer.length > 0) {
			return {
				status: "warn",
				message: `${TYPES_FILE} is older than what it is generated from`,
				findings: newer,
				fix: FIX,
			};
		}
		return passed(`${TYPES_FILE} is newer than ${CONFIG_FILE} and the env files`);
	},
};

/** When the file at `path` last changed, in milliseconds, or `null` when it does not exist. */
async function modified(root: string, path: string): Promise<number | null> {
	let found = await wrap(() => stat(join(root, path)));
	return isFailure(found) ? null : found.data.mtimeMs;
}
