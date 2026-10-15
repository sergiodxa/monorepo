/**
 * Migration chains: each configured chain is a folder of numbered SQL files applied in order of
 * their leading number. A new migration sorts after every file in its chain's folder and is
 * spelled like them, so a chain keeps one naming convention whichever tool wrote each file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Name } from "./names.js";

/** The chain `make migration` writes into without `--chain`. */
export const DEFAULT_CHAIN = "default";

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
 * How a chain spells its file names. `timestamp` numbers a file with the UTC time it was
 * written (`YYYYMMDDHHmmss`); `sequence` counts up, zero-padded to `width`.
 */
export interface MigrationConvention {
	numbering: "sequence" | "timestamp";
	width: number;
	separator: "-" | "_";
	case: "kebab" | "snake" | "pascal" | "camel";
}

/** The convention of an empty chain: `0001_CreatePosts.sql`. */
export const DEFAULT_CONVENTION: MigrationConvention = {
	numbering: "sequence",
	width: 4,
	separator: "_",
	case: "pascal",
};

/** A 14-digit leading number is a `YYYYMMDDHHmmss` timestamp. */
const TIMESTAMP_WIDTH = 14;

/** A migration file: its leading number, the separator after it, and its name. */
interface MigrationFile {
	number: string;
	separator: "-" | "_";
	name: string;
}

/** The shape of each case; a single lowercase word stays undecided, fitting kebab and snake alike. */
const CASE_PATTERNS: [MigrationConvention["case"], RegExp][] = [
	["kebab", /^[a-z0-9]+(-[a-z0-9]+)+$/],
	["snake", /^[a-z0-9]+(_[a-z0-9]+)+$/],
	["pascal", /^[A-Z][A-Za-z0-9]*$/],
	["camel", /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/],
];

/**
 * The convention of the SQL files in `files`, read from the newest file first: a chain that
 * changed its spelling keeps its latest one. A name of one lowercase word takes its case from
 * an older file, or from its separator when none tells; an empty chain takes the default.
 */
export function inferConvention(files: readonly string[]): MigrationConvention {
	let parsed = files
		.map(parseMigrationFile)
		.filter((file): file is MigrationFile => file !== null)
		.sort(compareNumbers)
		.reverse();
	let [newest] = parsed;
	if (newest === undefined) return DEFAULT_CONVENTION;
	let width = newest.number.length;
	let found = parsed
		.map((file) => CASE_PATTERNS.find(([, pattern]) => pattern.test(file.name))?.[0])
		.find((name) => name !== undefined);
	return {
		numbering: width === TIMESTAMP_WIDTH ? "timestamp" : "sequence",
		width,
		separator: newest.separator,
		case: found ?? (newest.separator === "-" ? "kebab" : "snake"),
	};
}

/**
 * The base name, without `.sql`, of the next migration in `folder` named `name`, following the
 * folder's convention. A sequence takes one after the highest number; a timestamp takes `now`,
 * or one past the highest when the clock reads earlier, so the file always applies last.
 */
export async function nextMigrationFile(
	root: string,
	folder: string,
	name: Name,
	now: Date = new Date(),
): Promise<Result<string, Error>> {
	let entries = await wrap(() => readdir(join(root, folder)));
	if (isFailure(entries)) {
		let code = (entries.error as NodeJS.ErrnoException).code;
		if (code !== "ENOENT") return entries;
	}
	let files = isFailure(entries) ? [] : entries.data;
	let convention = inferConvention(files);
	let highest = files
		.map(parseMigrationFile)
		.reduce((max, file) => (file === null ? max : Math.max(max, Number(file.number))), 0);
	let number = highest + 1;
	if (convention.numbering === "timestamp") number = Math.max(Number(timestamp(now)), number);
	let digits = String(number).padStart(convention.width, "0");
	return success(`${digits}${convention.separator}${spell(name, convention.case)}`);
}

/** `file` split into its parts, or `null` for anything but a numbered SQL file. */
function parseMigrationFile(file: string): MigrationFile | null {
	let match = /^(\d+)([-_])(.+)\.sql$/.exec(file);
	if (match === null) return null;
	let [, number = "", separator, name = ""] = match;
	return { number, separator: separator === "-" ? "-" : "_", name };
}

/** Orders files by their leading number, as the migration runners apply them. */
function compareNumbers(a: MigrationFile, b: MigrationFile): number {
	return Number(a.number) - Number(b.number);
}

/** `date` in UTC as `YYYYMMDDHHmmss`. */
function timestamp(date: Date): string {
	return date.toISOString().replace(/\D/g, "").slice(0, TIMESTAMP_WIDTH);
}

/** `name` in the given case. */
function spell(name: Name, spelling: MigrationConvention["case"]): string {
	if (spelling === "kebab") return name.base;
	if (spelling === "snake") return name.snake;
	if (spelling === "camel") return name.key;
	return name.pascal;
}
