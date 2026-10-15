/**
 * Migration chains: each configured chain is a folder of numbered SQL files applied in order,
 * so a new migration takes the number after the highest one in its chain's folder. A project
 * with a second schema, such as a Durable Object's own database, keeps it as a second chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

/** The chain `make migration` writes into without `--chain`. */
export const DEFAULT_CHAIN = "default";

/** How many digits a migration number is padded to. */
const NUMBER_WIDTH = 4;

/**
 * The folder of `chain` among the configured `chains`. An unknown chain is a failure listing
 * the configured ones.
 */
export function chainFolder(
	chains: Readonly<Record<string, string>>,
	chain: string | undefined,
): Result<string, Error> {
	let name = chain ?? DEFAULT_CHAIN;
	let folder = chains[name];
	if (folder === undefined) {
		let configured = Object.keys(chains).sort().join(", ");
		return failure(
			new Error(`No migration chain "${name}" in make.migrations; configured: ${configured}`),
		);
	}
	return success(folder);
}

/**
 * The number the next migration in `folder` takes, zero-padded: one after the highest number
 * a file there starts with, or `0001` for a missing or empty folder.
 */
export async function nextMigrationNumber(
	root: string,
	folder: string,
): Promise<Result<string, Error>> {
	let entries = await wrap(() => readdir(join(root, folder)));
	if (isFailure(entries)) {
		let code = (entries.error as NodeJS.ErrnoException).code;
		if (code !== "ENOENT") return entries;
	}
	let names = isFailure(entries) ? [] : entries.data;
	let highest = 0;
	for (let name of names) {
		let number = /^(\d+)[_-]/.exec(name)?.[1];
		if (number !== undefined) highest = Math.max(highest, Number.parseInt(number, 10));
	}
	return success(String(highest + 1).padStart(NUMBER_WIDTH, "0"));
}
