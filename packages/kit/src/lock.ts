/**
 * The CLI's state file: JSON Lines at the configured `lock` path, one entry per line sorted by
 * `kind` then `name`, so every command changes exactly the lines of what it touched. Entries of
 * a kind this CLI does not know are kept byte for byte, so state a newer CLI wrote survives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { JSONSchema } from "@sdxc/json-schema";
import type { Result } from "@sdxc/result";

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as JSONL from "@sdxc/jsonl";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { Config } from "./config.js";

import { resolveInside } from "./project.js";

/** Where the lock file lives when the configuration does not move it. */
export const DEFAULT_LOCK = ".config/sdxc.lock.jsonl";

/** A component or file name: lowercase segments, so a lock line can never name a path. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** A copied file's name relative to `ui.directory`, one segment with no `..`. */
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The `sha256-<base64>` form every recorded hash takes. */
const HASH = /^sha256-[A-Za-z0-9+/]+={0,2}$/;

/** What every line holds, whatever its kind; the rest of a line belongs to its kind. */
const ENTRY_KEYS = s.object({ kind: s.string(), name: s.string() }, { unknownKeys: "passthrough" });

/** A `ui` line: a vendored component, the release it came from and every file written for it. */
export const UI_LOCK_ENTRY = s.object(
	{
		kind: s.literal("ui").meta({ description: "The command group that owns the entry" }),
		name: s
			.string()
			.pipe(checks.pattern(NAME))
			.meta({ description: "The component, as `@sdxc/ui/<name>` imports it" }),
		release: s.string().meta({ description: "The release the copy came from" }),
		files: s
			.record(s.string().pipe(checks.pattern(FILE_NAME)), s.string().pipe(checks.pattern(HASH)))
			.meta({
				description: "Each file written, relative to `ui.directory`, to the hash of its content",
			}),
	},
	{ unknownKeys: "error" },
);

/** A `ui` entry as the commands read and write it. */
export type UILockEntry = s.InferOutput<typeof UI_LOCK_ENTRY>;

/** One line of the file: a known entry parsed, or an unknown kind kept as written. */
export type LockLine =
	| { kind: "ui"; name: string; entry: UILockEntry }
	| { kind: string; name: string; text: string };

/** The state file as read: where it is, relative to the project root, and its lines in order. */
export interface Lock {
	path: string;
	lines: LockLine[];
}

/**
 * The entry schema as JSON Schema 2020-12, shipped as `lock.schema.json`: every line names its
 * `kind` and `name`, a `ui` line is held to the `ui` entry, and any other kind is accepted.
 */
export function lockJSONSchema(): Result<JSONSchema, Error> {
	let ui = s.toJSONSchema(UI_LOCK_ENTRY, { refs: "inline" });
	if (isFailure(ui)) return ui;
	let { $schema: _, ...uiEntry } = ui.data;
	return success({
		$schema: "https://json-schema.org/draft/2020-12/schema",
		description: "One line of the sdxc lock file, which the CLI writes and the project commits",
		type: "object",
		properties: {
			kind: { type: "string", description: "The command group that owns the entry" },
			name: { type: "string", description: "The entry's identity within its kind" },
		},
		required: ["kind", "name"],
		anyOf: [
			uiEntry,
			{
				properties: { kind: { type: "string", pattern: "^(?!ui$)" } },
				description: "An entry of a kind this release does not define, kept as written",
			},
		],
	});
}

/**
 * The lock file of the project at `root`, empty when there is none yet. A configured location
 * other than the default that is missing while the default exists is a failure naming both, so
 * moving `lock` never starts a second, empty state beside the real one.
 */
export async function readLock(root: string, config: Config): Promise<Result<Lock, Error>> {
	let path = config.lock;
	let absolute = resolveInside(root, path);
	if (isFailure(absolute)) return failure(new Error(`lock: ${absolute.error.message}`));
	let text = await wrap(() => readFile(absolute.data, "utf8"));
	if (isFailure(text)) {
		if (!isMissing(text.error)) return failure(new Error(`${path}: ${text.error.message}`));
		if (path !== DEFAULT_LOCK && (await isFile(join(root, DEFAULT_LOCK)))) {
			return failure(
				new Error(
					`lock is ${path}, which does not exist, but ${DEFAULT_LOCK} does; move ${DEFAULT_LOCK} to ${path} or set lock back to it`,
				),
			);
		}
		return success({ path, lines: [] });
	}
	return parseLock(path, text.data);
}

/**
 * The lines of a lock file's `text`. A line that is not JSON, fails its schema, or repeats a
 * `kind` and `name` already seen is a failure naming its line number, and nothing is returned.
 */
export async function parseLock(path: string, text: string): Promise<Result<Lock, Error>> {
	let lines: LockLine[] = [];
	let seen = new Map<string, number>();
	for await (let line of JSONL.lines(chunks(text))) {
		if (isFailure(line)) return failure(new Error(`${path}: ${line.error.message}`));
		let { text: raw, number } = line.data;
		let where = `${path}:${number}`;
		let value = wrap(() => JSON.parse(raw) as unknown);
		if (isFailure(value)) return failure(new Error(`${where}: not valid JSON`));
		let keys = s.parseSafe(ENTRY_KEYS, value.data);
		if (!keys.success)
			return failure(new Error(`${where}: every entry needs a string kind and name`));
		let { kind, name } = keys.value;
		let identity = `${kind}\0${name}`;
		let previous = seen.get(identity);
		if (previous !== undefined) {
			return failure(
				new Error(`${where}: repeats the ${kind} entry ${name} from line ${previous}; keep one`),
			);
		}
		seen.set(identity, number);
		if (kind !== "ui") {
			lines.push({ kind, name, text: raw });
			continue;
		}
		let entry = s.parseSafe(UI_LOCK_ENTRY, value.data);
		if (!entry.success) {
			let issues = entry.issues.map((issue) => {
				let key = (issue.path ?? []).map(pathSegment).join(".");
				return `${key === "" ? "(entry)" : key}: ${issue.message}`;
			});
			return failure(new Error(`${where}: ${issues.join("; ")}`));
		}
		lines.push({ kind, name, entry: entry.value });
	}
	return success({ path, lines });
}

/** Every `ui` entry, in file order. */
export function uiEntries(lock: Lock): UILockEntry[] {
	return lock.lines.flatMap((line) => ("entry" in line ? [line.entry] : []));
}

/** The `ui` entry for `name`, or `undefined` when that component is not copied. */
export function uiEntry(lock: Lock, name: string): UILockEntry | undefined {
	return uiEntries(lock).find((entry) => entry.name === name);
}

/** `lock` with `entry` replacing the line of the same name, or inserted where the order puts it. */
export function setUIEntry(lock: Lock, entry: UILockEntry): Lock {
	let lines = lock.lines.filter((line) => !(line.kind === "ui" && line.name === entry.name));
	lines.push({ kind: "ui", name: entry.name, entry });
	lines.sort(compareLines);
	return { ...lock, lines };
}

/** `lock` without the `ui` line for `name`; every other line is unchanged. */
export function removeUIEntry(lock: Lock, name: string): Lock {
	return {
		...lock,
		lines: lock.lines.filter((line) => !(line.kind === "ui" && line.name === name)),
	};
}

/**
 * The file's text: one `\n`-terminated line per entry, sorted, known entries with their keys in
 * schema order and unknown ones exactly as read.
 */
export function renderLock(lock: Lock): Result<string, Error> {
	let text = "";
	for (let line of [...lock.lines].sort(compareLines)) {
		if (!("entry" in line)) {
			text += `${line.text}\n`;
			continue;
		}
		let { kind, name, release, files } = line.entry;
		let ordered = Object.fromEntries(
			Object.entries(files).sort(([a], [b]) => {
				if (a < b) return -1;
				if (a > b) return 1;
				return 0;
			}),
		);
		let rendered = JSONL.stringify([{ kind, name, release, files: ordered }]);
		if (isFailure(rendered)) return rendered;
		text += rendered.data;
	}
	return success(text);
}

/** Writes `lock` at its path in `root`, creating its folders; a lock with no lines is removed. */
export async function writeLock(root: string, lock: Lock): Promise<Result<void, Error>> {
	let absolute = resolveInside(root, lock.path);
	if (isFailure(absolute)) return absolute;
	let target = absolute.data;
	let text = renderLock(lock);
	if (isFailure(text)) return text;
	let content = text.data;
	return wrap(async () => {
		if (content === "") {
			await rm(target, { force: true });
			return;
		}
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content);
	});
}

/** Lines ordered by `kind`, then `name`, by code unit so every machine sorts alike. */
function compareLines(a: LockLine, b: LockLine): number {
	let left = `${a.kind}\0${a.name}`;
	let right = `${b.kind}\0${b.name}`;
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

/**
 * `text` as the byte source {@link JSONL.lines} reads.
 *
 * @yields The whole text, encoded, as one chunk.
 */
async function* chunks(text: string): AsyncGenerator<Uint8Array> {
	yield new TextEncoder().encode(text);
}

function isMissing(error: Error): boolean {
	return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function isFile(path: string): Promise<boolean> {
	let found = await wrap(() => stat(path));
	return isSuccess(found) && found.data.isFile();
}

/** One segment of a Standard Schema issue path, which may be a bare key or a `{ key }` record. */
function pathSegment(segment: PropertyKey | { key: PropertyKey }): string {
	return String(typeof segment === "object" ? segment.key : segment);
}
