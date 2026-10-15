/**
 * What each `sdxc ui` command does, as plans over the project: `add`, `update` and `remove`
 * answer every file they would write, edit or delete and the lock entries they would record,
 * so `--dry-run` prints exactly what applying the same plan writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { compare } from "@sdxc/semver";

import type { Config } from "../config.js";
import type { Lock, UILockEntry } from "../lock.js";

import { unifiedDiff } from "../diff.js";
import { formatFiles } from "../format.js";
import {
	readLock,
	removeUIEntry,
	renderLock,
	setUIEntry,
	uiEntries,
	uiEntry,
	writeLock,
} from "../lock.js";

import type { CopiedComponent } from "./imports.js";
import type { CopyLayout } from "./layout.js";
import type { Registry, RegistryEntry } from "./registry.js";

import { copyPath, pointAtCopies, pointBack, projectSources, readProjectFile } from "./imports.js";
import { readLayout } from "./layout.js";
import { readRegistry, withDependencies } from "./registry.js";

/** Everything a `ui` command reads before it plans. */
export interface UIContext {
	root: string;
	config: Config;
	registry: Registry;
	lock: Lock;
	layout: CopyLayout;
}

/** One file a plan touches, relative to the project root; `after: null` deletes it. */
export interface FileChange {
	before: string | null;
	after: string | null;
}

/** A lock entry to record once its files are written. */
export interface PendingEntry {
	name: string;
	release: string;
	/** Each file relative to `ui.directory`: a hash to keep, or `null` to hash once written. */
	files: Record<string, string | null>;
}

/** What `add`, `update` or `remove` would change. */
export interface Plan {
	files: Map<string, FileChange>;
	record: PendingEntry[];
	forget: string[];
	/** Lines for the user: what the command did, and what it left for them to do. */
	report: string[];
}

/** One row of `sdxc ui list`. */
export interface ListRow {
	name: string;
	/** The release whose commits last touched it, or `null` for a copy the registry lacks. */
	changedIn: string | null;
	copy: { release: string; edited: boolean; behind: boolean } | null;
}

/** What a `ui` command's handler runs with: its context, and its prompts, tasks and processes. */
export type UICommandContext = Pick<AnyCommandContext, "exec" | "task" | "stdout" | "stderr">;

/**
 * Reads the installed registry, the lock file and the copies' layout of the project at `root`.
 *
 * @param packageRoot - The `sdxc` package holding the registry.
 */
export async function loadContext(
	project: { root: string; config: Config },
	packageRoot: string,
): Promise<Result<UIContext, Error>> {
	let { root, config } = project;
	let registry = await readRegistry(packageRoot);
	if (isFailure(registry)) return registry;
	let lock = await readLock(root, config);
	if (isFailure(lock)) return lock;
	let layout = await readLayout(root, config);
	if (isFailure(layout)) return layout;
	return success({ root, config, registry: registry.data, lock: lock.data, layout: layout.data });
}

/** The hash a lock entry records for a file's content: SHA-256, base64, `sha256-` prefixed. */
export function hashContent(content: string): string {
	return `sha256-${createHash("sha256").update(content).digest("base64")}`;
}

/**
 * Every component in the registry, and every copy the registry no longer holds, sorted by
 * name. A copy is edited when a file it recorded is missing or hashes differently, and behind
 * when the component changed in a release after the one it came from.
 */
export async function listComponents(context: UIContext): Promise<ListRow[]> {
	let names = new Set([
		...context.registry.entries.keys(),
		...uiEntries(context.lock).map((entry) => entry.name),
	]);
	let rows: ListRow[] = [];
	for (let name of [...names].sort()) {
		let entry = context.registry.entries.get(name);
		let copied = uiEntry(context.lock, name);
		let copy: ListRow["copy"] = null;
		if (copied !== undefined) {
			copy = {
				release: copied.release,
				edited: await isEdited(context, copied),
				behind: entry !== undefined && compare(copied.release, entry.changedIn) < 0,
			};
		}
		rows.push({ name, changedIn: entry?.changedIn ?? null, copy });
	}
	return rows;
}

/**
 * Copies `names` (and, with `withDeps`, every component they reach) into `ui.directory`, with
 * their tests under `ui.tests`, and points every project file's imports of them at the copies.
 * A component already copied is reported and left alone; a file in the way stops the plan.
 */
export async function planAdd(
	context: UIContext,
	names: readonly string[],
	options: { withDeps: boolean },
): Promise<Result<Plan, Error>> {
	let unknown = unknownNames(context, names);
	if (unknown !== null) return failure(unknown);
	let plan = emptyPlan();
	let wanted = options.withDeps ? withDependencies(context.registry, names) : [...new Set(names)];
	let added: RegistryEntry[] = [];
	for (let name of wanted) {
		let entry = context.registry.entries.get(name);
		if (entry === undefined) continue;
		if (uiEntry(context.lock, name) !== undefined) {
			if (names.includes(name)) {
				plan.report.push(`${name} is already copied; sdxc ui update ${name} replaces it`);
			}
			continue;
		}
		added.push(entry);
	}
	let copies = copiedComponents(context, added);
	for (let entry of added) {
		let files: Record<string, null> = {};
		for (let file of registryFiles(entry, context.config.ui.tests)) {
			let path = copyPath(context.layout, file.path);
			let existing = await readProjectFile(context.root, path);
			if (existing !== null) {
				return failure(
					new Error(`${path} already exists and the lock file does not list it; move it first`),
				);
			}
			let content = pointAtCopies(path, file.content, copies, context.layout);
			if (isFailure(content)) return content;
			plan.files.set(path, { before: null, after: content.data.source });
			files[file.path] = null;
		}
		plan.record.push({ name: entry.name, release: context.registry.release, files });
		plan.report.push(`Copied ${entry.name} to ${copyPath(context.layout, entry.source.path)}`);
	}
	let rewritten = await rewriteProject(context, plan, (file, source) =>
		pointAtCopies(file, source, copiedComponents(context, added, false), context.layout),
	);
	if (isFailure(rewritten)) return rewritten;
	return success(plan);
}

/**
 * The difference between the copy of `name` and the installed version, as a unified diff from
 * the installed file to the local one, or an empty string when they match.
 */
export async function diffComponent(
	context: UIContext,
	name: string,
): Promise<Result<string, Error>> {
	let copied = uiEntry(context.lock, name);
	if (copied === undefined) return failure(new Error(`${name} is not copied; sdxc ui add ${name}`));
	let entry = context.registry.entries.get(name);
	if (entry === undefined) {
		return failure(new Error(`sdxc ${context.registry.release} no longer ships ${name}`));
	}
	let copies = copiedComponents(context, []);
	let output = "";
	for (let file of registryFiles(entry, copied.files[entry.test?.path ?? ""] !== undefined)) {
		let path = copyPath(context.layout, file.path);
		let installed = pointAtCopies(path, file.content, copies, context.layout);
		if (isFailure(installed)) return installed;
		let local = await readProjectFile(context.root, path);
		output += unifiedDiff(path, installed.data.source, local);
	}
	return success(output);
}

/**
 * Replaces each file of each copy whose hash still matches the lock with the installed version.
 * An edited file is replaced only when `overwrite` answers yes for it, and otherwise left alone
 * and reported; the entry moves to the installed release only when every file was replaced.
 */
export async function planUpdate(
	context: UIContext,
	names: readonly string[],
	options: { overwrite: (path: string) => Promise<Result<boolean, Error>> },
): Promise<Result<Plan, Error>> {
	let unknown = uncopiedNames(context, names);
	if (unknown !== null) return failure(unknown);
	let plan = emptyPlan();
	let copies = copiedComponents(context, []);
	for (let name of new Set(names)) {
		let copied = uiEntry(context.lock, name);
		let entry = context.registry.entries.get(name);
		if (copied === undefined) continue;
		if (entry === undefined) {
			plan.report.push(`sdxc ${context.registry.release} no longer ships ${name}; left as it is`);
			continue;
		}
		let withTest =
			context.config.ui.tests || (entry.test !== null && entry.test.path in copied.files);
		let files: Record<string, string | null> = { ...copied.files };
		let skipped = 0;
		let replaced = 0;
		for (let file of registryFiles(entry, withTest)) {
			let path = copyPath(context.layout, file.path);
			let local = await readProjectFile(context.root, path);
			let recorded = copied.files[file.path];
			let untouched = local === null || (recorded !== undefined && hashContent(local) === recorded);
			if (!untouched) {
				let overwrite = await options.overwrite(path);
				if (isFailure(overwrite)) return overwrite;
				if (!overwrite.data) {
					skipped += 1;
					plan.report.push(`${path} is edited; left as it is (--force replaces it)`);
					continue;
				}
			}
			let content = pointAtCopies(path, file.content, copies, context.layout);
			if (isFailure(content)) return content;
			files[file.path] = null;
			if (content.data.source === local) {
				files[file.path] = hashContent(local);
				continue;
			}
			plan.files.set(path, { before: local, after: content.data.source });
			replaced += 1;
		}
		let release = skipped === 0 ? context.registry.release : copied.release;
		plan.record.push({ name, release, files });
		plan.report.push(
			replaced === 0 && skipped === 0
				? `${name} already matches sdxc ${context.registry.release}`
				: `Updated ${replaced} file${replaced === 1 ? "" : "s"} of ${name}`,
		);
	}
	return success(plan);
}

/**
 * Deletes the copies of `names`, drops their lock entries and points every project file's
 * imports of them back at `sdxc/ui/<name>`, folded into an existing `sdxc/ui` import.
 */
export async function planRemove(
	context: UIContext,
	names: readonly string[],
): Promise<Result<Plan, Error>> {
	let unknown = uncopiedNames(context, names);
	if (unknown !== null) return failure(unknown);
	let plan = emptyPlan();
	let removed: CopiedComponent[] = [];
	for (let name of new Set(names)) {
		let copied = uiEntry(context.lock, name);
		if (copied === undefined) continue;
		for (let file of Object.keys(copied.files)) {
			let path = copyPath(context.layout, file);
			let local = await readProjectFile(context.root, path);
			if (local !== null) plan.files.set(path, { before: local, after: null });
		}
		plan.forget.push(name);
		removed.push({ name, exports: context.registry.entries.get(name)?.exports ?? [] });
		plan.report.push(`Removed ${name}`);
	}
	let rewritten = await rewriteProject(context, plan, (file, source) => {
		let result = pointBack(file, source, removed, context.layout);
		if (isFailure(result)) return result;
		return success({ source: result.data, unhandled: [] });
	});
	if (isFailure(rewritten)) return rewritten;
	return success(plan);
}

/**
 * Writes and deletes the plan's files as a task counting each one, runs `format` over what it
 * wrote, then records the lock entries with each new file hashed as it ended up. A failed
 * `format` is reported, and the hashes are then of the files as written.
 */
export async function applyPlan(
	ctx: UICommandContext,
	context: UIContext,
	plan: Plan,
): Promise<Result<string[], Error>> {
	let report = [...plan.report];
	let written: string[] = [];
	if (plan.files.size > 0) {
		let applied = await ctx.task("Writing files", async (task) => {
			task.total(plan.files.size);
			for (let [path, change] of plan.files) {
				let target = join(context.root, path);
				if (change.after === null) {
					await rm(target, { force: true });
				} else {
					await mkdir(dirname(target), { recursive: true });
					await writeFile(target, change.after);
					written.push(path);
				}
				task.advance();
			}
		});
		if (isFailure(applied)) return applied;
	}
	let formatted = await formatFiles(ctx, context.config.format, written, context.root);
	if (isFailure(formatted)) {
		report.push(`${formatted.error.message}; the lock file records them as written`);
	}
	let lock = await settleLock(context, plan, async (path) => readProjectFile(context.root, path));
	if (isFailure(lock)) return lock;
	let saved = await writeLock(context.root, lock.data);
	if (isFailure(saved)) return saved;
	return success(report);
}

/**
 * Prints the plan's diff on stdout and its report on stderr under `--dry-run`; otherwise applies
 * it and prints its report on stdout.
 */
export async function finishPlan(
	ctx: UICommandContext,
	context: UIContext,
	plan: Plan,
	dryRun: boolean,
): Promise<Result<void, Error>> {
	if (dryRun) {
		let diff = await renderPlan(context, plan);
		if (isFailure(diff)) return diff;
		ctx.stdout(diff.data);
		for (let line of plan.report) ctx.stderr(`${line}\n`);
		return success(undefined);
	}
	let report = await applyPlan(ctx, context, plan);
	if (isFailure(report)) return report;
	for (let line of report.data) ctx.stdout(`${line}\n`);
	return success(undefined);
}

/**
 * The diff of every file the plan touches and of the lock file, which is what applying it
 * writes before `format` runs; the lock's hashes are of the files as the CLI writes them.
 */
export async function renderPlan(context: UIContext, plan: Plan): Promise<Result<string, Error>> {
	let output = "";
	for (let [path, change] of [...plan.files].sort(([a], [b]) => (a < b ? -1 : 1))) {
		output += unifiedDiff(path, change.before, change.after);
	}
	let lock = await settleLock(context, plan, async (path) => {
		let change = plan.files.get(path);
		return change === undefined ? readProjectFile(context.root, path) : change.after;
	});
	if (isFailure(lock)) return lock;
	let before = renderLock(context.lock);
	let after = renderLock(lock.data);
	if (isFailure(before)) return before;
	if (isFailure(after)) return after;
	output += unifiedDiff(
		context.lock.path,
		before.data === "" ? null : before.data,
		after.data === "" ? null : after.data,
	);
	return success(output);
}

/** The lock once the plan's entries are recorded, hashing each pending file through `read`. */
async function settleLock(
	context: UIContext,
	plan: Plan,
	read: (path: string) => Promise<string | null>,
): Promise<Result<Lock, Error>> {
	let lock = context.lock;
	for (let name of plan.forget) lock = removeUIEntry(lock, name);
	for (let pending of plan.record) {
		let files: Record<string, string> = {};
		for (let [file, hash] of Object.entries(pending.files)) {
			if (hash !== null) {
				files[file] = hash;
				continue;
			}
			let content = await read(copyPath(context.layout, file));
			if (content === null) return failure(new Error(`${file} was not written`));
			files[file] = hashContent(content);
		}
		let entry: UILockEntry = { kind: "ui", name: pending.name, release: pending.release, files };
		lock = setUIEntry(lock, entry);
	}
	return success(lock);
}

/**
 * Runs `transform` over every project source outside the plan's own files, adding each file it
 * changes to the plan and reporting each import it could not rewrite.
 */
async function rewriteProject(
	context: UIContext,
	plan: Plan,
	transform: (
		file: string,
		source: string,
	) => Result<{ source: string; unhandled: string[] }, Error>,
): Promise<Result<void, Error>> {
	let sources = await projectSources(context.root);
	if (isFailure(sources)) return sources;
	for (let file of sources.data) {
		if (plan.files.has(file)) continue;
		let source = await readProjectFile(context.root, file);
		if (source === null) continue;
		let rewritten = transform(file, source);
		if (isFailure(rewritten)) return failure(new Error(`${file}: ${rewritten.error.message}`));
		if (rewritten.data.source !== source) {
			plan.files.set(file, { before: source, after: rewritten.data.source });
		}
		for (let location of rewritten.data.unhandled) {
			plan.report.push(
				`${location} imports sdxc/ui as a whole; import the copied components' names from their copies by hand`,
			);
		}
	}
	return success(undefined);
}

/**
 * Every copy the rewrite points imports at: the lock's copies plus `added`, with the names the
 * registry says each exports. `includeLocked: false` answers `added` alone.
 */
function copiedComponents(
	context: UIContext,
	added: readonly RegistryEntry[],
	includeLocked = true,
): CopiedComponent[] {
	let names = new Set(added.map((entry) => entry.name));
	if (includeLocked) for (let entry of uiEntries(context.lock)) names.add(entry.name);
	return [...names].flatMap((name) => {
		let entry = context.registry.entries.get(name);
		return entry === undefined ? [] : [{ name, exports: entry.exports }];
	});
}

/** The entry's source, and its test when `withTest` and it has one. */
function registryFiles(entry: RegistryEntry, withTest: boolean): RegistryEntry["source"][] {
	return withTest && entry.test !== null ? [entry.source, entry.test] : [entry.source];
}

/** Whether any file the lock recorded for the copy is missing or no longer hashes the same. */
async function isEdited(context: UIContext, copied: UILockEntry): Promise<boolean> {
	for (let [file, hash] of Object.entries(copied.files)) {
		let content = await readProjectFile(context.root, copyPath(context.layout, file));
		if (content === null || hashContent(content) !== hash) return true;
	}
	return false;
}

/** A failure naming every one of `names` the registry does not ship, or `null`. */
function unknownNames(context: UIContext, names: readonly string[]): Error | null {
	let unknown = names.filter((name) => !context.registry.entries.has(name));
	if (unknown.length === 0) return null;
	return new Error(
		`sdxc ${context.registry.release} ships no component named ${unknown.join(", ")}; sdxc ui list shows every one`,
	);
}

/** A failure naming every one of `names` the lock file does not list as copied, or `null`. */
function uncopiedNames(context: UIContext, names: readonly string[]): Error | null {
	let missing = names.filter((name) => uiEntry(context.lock, name) === undefined);
	if (missing.length === 0) return null;
	return new Error(`Not copied: ${missing.join(", ")}; sdxc ui list shows the copies`);
}

function emptyPlan(): Plan {
	return { files: new Map(), record: [], forget: [], report: [] };
}
