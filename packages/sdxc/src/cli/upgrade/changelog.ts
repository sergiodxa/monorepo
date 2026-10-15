/**
 * The `changelog.jsonl` every published `sdxc` carries: one entry per commit, package and
 * release, written by the release build. `sdxc upgrade` reads it offline from the installed
 * package, so the prompt describes exactly the releases that package was built from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import * as s from "@sdxc/json-schema";
import * as JSONL from "@sdxc/jsonl";
import { failure, isFailure, success, wrap } from "@sdxc/result";
import { compare } from "@sdxc/semver";

/** The file name at the root of the `sdxc` package. */
export const CHANGELOG_FILE = "changelog.jsonl";

/** One line of the changelog; unknown keys are ignored so a newer file still reads. */
const ENTRY_SCHEMA = s.object({
	release: s.string(),
	package: s.string(),
	type: s.string(),
	breaking: s.boolean(),
	title: s.string(),
	body: s.string(),
});

/** One commit's note as it applies to one package in one release. */
export type ChangelogEntry = s.InferOutput<typeof ENTRY_SCHEMA>;

/**
 * Every entry of the changelog in the `sdxc` package at `packageRoot`. A missing file, a line
 * that is not JSON, or a line without the entry fields is a failure naming the file and line.
 */
export async function readChangelog(packageRoot: string): Promise<Result<ChangelogEntry[], Error>> {
	let path = join(packageRoot, CHANGELOG_FILE);
	let text = await wrap(() => readFile(path, "utf8"));
	if (isFailure(text)) {
		return failure(new Error(`This sdxc carries no ${CHANGELOG_FILE} (${path})`));
	}
	let values = JSONL.parse(text.data);
	if (isFailure(values)) return failure(new Error(`${path}: ${values.error.message}`));
	let entries: ChangelogEntry[] = [];
	for (let [index, value] of values.data.entries()) {
		let checked = s.parseSafe(ENTRY_SCHEMA, value);
		if (!checked.success) {
			return failure(new Error(`${path}: entry ${index + 1} is not a changelog entry`));
		}
		entries.push(checked.value);
	}
	return success(entries);
}

/** The entries of releases after `from` up to and including `to`, in file order. */
export function entriesBetween(
	entries: readonly ChangelogEntry[],
	from: string,
	to: string,
): ChangelogEntry[] {
	return entries.filter(
		(entry) => compare(entry.release, from) > 0 && compare(entry.release, to) <= 0,
	);
}

/**
 * The first day the changelog of release `version` covers in full, as a dated version: the
 * same calendar day a year earlier. Releases before it kept only their breaking entries.
 */
export function fullHistoryStart(version: string): string {
	let [year = 0, month = 1, day = 1] = version.split(".").map(Number);
	return `${year - 1}.${month}.${day}`;
}
