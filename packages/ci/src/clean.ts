/**
 * The `clean` action: removes the step cache and the run history a clone's runs keep below its
 * shared git directory, so a stale or oversized store starts over, while the signoff records
 * `signoff` posts from stay where they are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import type { ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit, success } from "@sdxc/cli";
import { isFailure, wrap } from "@sdxc/result";

import type { ActionIO } from "./cli-actions.js";

import { cacheDirectory } from "./cache.js";
import { repositoryRoot, sharedGitDirectory } from "./git.js";
import { runsDirectory } from "./runs.js";

/** Exit code for a usage error or input that cannot be read. */
const UNREADABLE = 2;

/** What `clean` reads. */
export interface CleanInput {
	json?: boolean;
}

/** What `clean` removed: every file below the stores, and their combined size. */
export interface CleanReport {
	/** The store directories, as absolute paths; each is gone after a clean. */
	directories: string[];
	files: number;
	bytes: number;
}

/** The stores `clean` empties: step passes and run history; signoff records sit beside them. */
export function cleanedDirectories(gitDirectory: string): string[] {
	return [cacheDirectory(gitDirectory), runsDirectory(gitDirectory)];
}

/** How many files lie below `directory` and their combined size; zero for a missing one. */
async function measure(directory: string): Promise<{ files: number; bytes: number }> {
	let listed = await wrap(() => readdir(directory, { recursive: true, withFileTypes: true }));
	if (isFailure(listed)) return { files: 0, bytes: 0 };
	let totals = { files: 0, bytes: 0 };
	for (let entry of listed.data) {
		if (!entry.isFile()) continue;
		let info = await wrap(() => stat(join(entry.parentPath, entry.name)));
		if (isFailure(info)) continue;
		totals.files += 1;
		totals.bytes += info.data.size;
	}
	return totals;
}

/**
 * Removes the step cache and run history below `gitDirectory`, measuring each first so the
 * report says what was freed. A store that does not exist counts as empty.
 */
export async function cleanStores(gitDirectory: string): Promise<Result<CleanReport, Error>> {
	let report: CleanReport = { directories: cleanedDirectories(gitDirectory), files: 0, bytes: 0 };
	for (let directory of report.directories) {
		let totals = await measure(directory);
		let removed = await wrap(() => rm(directory, { recursive: true, force: true }));
		if (isFailure(removed)) return removed;
		report.files += totals.files;
		report.bytes += totals.bytes;
	}
	return success(report);
}

/** `bytes` as a person reads it: 0 B, 812 B, 4.2 KB, 13.0 MB. */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	let units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Empties the step cache and run history of the clone holding `io.cwd`, printing how many files
 * and bytes went. Exits 2 outside a git repository or when a store cannot be removed.
 */
export async function cleanAction(
	io: ActionIO,
	input: CleanInput,
): Promise<Result<undefined, ExitError>> {
	let root = await repositoryRoot(io.cwd);
	if (isFailure(root)) return exit(UNREADABLE, "Not inside a git repository");
	let gitDirectory = await sharedGitDirectory(root.data);
	if (isFailure(gitDirectory)) return exit(UNREADABLE, "Cannot read the git directory");
	let cleaned = await cleanStores(gitDirectory.data);
	if (isFailure(cleaned)) return exit(UNREADABLE, `Cannot clean: ${cleaned.error.message}`);
	let report = cleaned.data;
	if (input.json === true) io.stdout(`${JSON.stringify(report, null, 2)}\n`);
	else if (report.files === 0)
		io.stdout("Nothing to clean: the cache and run history are empty.\n");
	else {
		let noun = report.files === 1 ? "file" : "files";
		io.stdout(
			`Removed ${report.files} ${noun} (${formatBytes(report.bytes)}) from the cache and run history.\n`,
		);
	}
	return success();
}
