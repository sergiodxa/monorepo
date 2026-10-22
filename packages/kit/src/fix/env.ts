/**
 * `sdxc fix env`: appends every `bindings.secret()` key that `.env.example` leaves out, as empty
 * `KEY=` lines, so CI's typegen and the env check agree without inventing secret values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { iife } from "@sdxc/iife";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import { unifiedDiff } from "../diff.js";
import { CONFIG_FILE, ENV_EXAMPLE_FILE, declaredBindings, exampleKeys } from "../doctor/env.js";

/** What `fix env` decided before writing. */
export interface EnvFixPlan {
	/** Keys that will be appended. */
	missing: string[];
	/** Diff of `.env.example`, empty when nothing changes. */
	diff: string;
	/** Full file text after the append. */
	after: string;
}

/**
 * Plans the `.env.example` append for secrets declared in `cloudflare.config.ts` and missing
 * from the example file.
 */
export async function planEnvFix(root: string): Promise<Result<EnvFixPlan, Error>> {
	let config = await wrap(() => readFile(join(root, CONFIG_FILE), "utf8"));
	if (isFailure(config)) return failure(new Error(`No ${CONFIG_FILE} in the project`));
	let declared = declaredBindings(config.data);
	let example = await wrap(() => readFile(join(root, ENV_EXAMPLE_FILE), "utf8"));
	let before = isFailure(example) ? "" : example.data;
	let listed = exampleKeys(before);
	let missing = [...declared]
		.filter(([key, kind]) => kind === "secret" && !listed.has(key))
		.map(([key]) => key);
	if (missing.length === 0) {
		return success({ missing: [], diff: "", after: before });
	}
	let block = missing.map((key) => `${key}=`).join("\n");
	let after = iife(() => {
		if (before === "") return `${block}\n`;
		if (before.endsWith("\n")) return `${before}\n${block}\n`;
		return `${before}\n\n${block}\n`;
	});
	return success({
		missing,
		diff: unifiedDiff(ENV_EXAMPLE_FILE, before === "" ? null : before, after),
		after,
	});
}

/** Writes the planned `.env.example`, or returns its diff under `dryRun`. */
export async function fixEnv(
	root: string,
	options: { dryRun: boolean },
): Promise<Result<{ missing: string[]; diff: string }, Error>> {
	let planned = await planEnvFix(root);
	if (isFailure(planned)) return planned;
	if (planned.data.missing.length === 0) {
		return success({ missing: [], diff: "" });
	}
	if (!options.dryRun) {
		await writeFile(join(root, ENV_EXAMPLE_FILE), planned.data.after);
	}
	return success({ missing: planned.data.missing, diff: planned.data.diff });
}
