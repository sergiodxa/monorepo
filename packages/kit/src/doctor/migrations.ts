/**
 * The `migrations` check: every chain in `make.migrations` replays on an empty database with
 * double-quoted string literals disabled. A new database, a new tenant or a fresh test run
 * replays the whole chain, so a file that only applied on top of old state breaks there first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import type { Config } from "../config.js";

import type { Check, CheckResult } from "./check.js";

import { skipped } from "./check.js";

/** One entry of `doctor.migrations.accept`. */
type AcceptedEntry = Config["doctor"]["migrations"]["accept"][number];

/**
 * Fails on each chain whose replay stops, naming the file and SQLite's error. An error that
 * `doctor.migrations.accept` lists is stepped past and reported as a finding, so the rest of the
 * chain is still checked; an entry no error matches any more warns, so the list stays current.
 * The replay code loads `node:sqlite` on first use, so a runtime without it skips this check alone.
 */
export const migrationsCheck: Check = {
	name: "migrations",
	async run(context): Promise<CheckResult> {
		let loaded = await import("../make/from-model.js").then(
			async (fromModel) => ({ fromModel, schema: await import("../make/schema-diff.js") }),
			(error: unknown) => (error instanceof Error ? error : new Error(String(error))),
		);
		if (loaded instanceof Error) return skipped(`Could not load SQLite: ${loaded.message}`);
		let { fromModel, schema } = loaded;
		let entries = context.config.doctor.migrations.accept;
		let matched = new Set<AcceptedEntry>();
		let accepts = (file: string, message: string): boolean => {
			let entry = entries.find((item) => item.file === file && namesColumn(message, item.column));
			if (entry === undefined) return false;
			matched.add(entry);
			return true;
		};
		let findings: string[] = [];
		let accepted: string[] = [];
		let replayed: string[] = [];
		for (let folder of Object.values(context.config.make.migrations)) {
			let chain = await fromModel.readChain(context.root, folder);
			if (isFailure(chain)) {
				findings.push(`${folder}: ${chain.error.message}`);
				continue;
			}
			if (chain.data.length === 0) continue;
			let replay = schema.replayChain(chain.data, { accepts });
			if (isFailure(replay)) {
				findings.push(`${folder}/${replay.error.message}`);
				continue;
			}
			replay.data.db.close();
			for (let failure of replay.data.accepted) {
				accepted.push(`${folder}/${failure.file} accepted: ${failure.message}`);
			}
			replayed.push(folder);
		}
		if (findings.length > 0) {
			return {
				status: "fail",
				message: `${findings.length === 1 ? "A migration chain does" : `${findings.length} migration chains do`} not replay on an empty database`,
				findings,
				fix: "Make the named migration apply to an empty database: quote strings with single quotes, and read a column's old name in a rebuild's SELECT. A migration production already ran goes in doctor.migrations.accept instead",
			};
		}
		let stale = entries
			.filter((entry) => !matched.has(entry))
			.map((entry) => `${entry.file} no longer fails on ${entry.column}`);
		if (stale.length > 0) {
			return {
				status: "warn",
				message:
					stale.length === 1
						? "An accepted migration failure no longer fails"
						: `${stale.length} accepted migration failures no longer fail`,
				findings: [...stale, ...accepted],
				fix: "Remove each entry named above from doctor.migrations.accept in the sdxc configuration",
			};
		}
		if (replayed.length === 0) return skipped("The project has no migrations");
		let replays = `${replayed.join(", ")} ${replayed.length === 1 ? "replays" : "replay"} on an empty database`;
		return {
			status: "pass",
			message:
				accepted.length === 0
					? replays
					: `${replays} past ${accepted.length === 1 ? "an accepted failure" : `${accepted.length} accepted failures`}`,
			findings: accepted,
			fix: null,
		};
	},
};

/**
 * Whether SQLite's error `message` names `column`, quoted or bare, alone or qualified by its
 * table, so an entry accepts the error it was written for and no other in the same file.
 */
function namesColumn(message: string, column: string): boolean {
	let named = /column(?: name)?: "?([^"\s]+)"?/.exec(message)?.[1];
	return named === column || named?.endsWith(`.${column}`) === true;
}
