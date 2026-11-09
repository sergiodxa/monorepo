/**
 * Turns rendered files into a plan, then writes it. Planning reads the disk and writes nothing,
 * so a dry run and the real run see the same answer: every file is a create, a replace or a
 * conflict, and a plan with a conflict writes nothing at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, posix, resolve } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isSuccess, success, wrap } from "@sdxc/result";

import { BlueprintError } from "./errors.js";

/** A rendered file to write. */
export interface FileToWrite {
	/** Relative to the plan's root, with `/` separators. */
	path: string;
	content: string;
	/** The stub it came from, named in errors. */
	source?: string;
}

/**
 * What writing a file does: `create` a new one, `replace` one that exists because the plan was
 * forced, or stop on a `conflict` with one that exists.
 */
export type Action = "create" | "replace" | "conflict";

/** One file of a plan. */
export interface PlannedFile {
	/** Relative to the root, normalized, with `/` separators. */
	path: string;
	content: string;
	action: Action;
}

/** Files ready to write under one root. */
export interface Plan {
	root: string;
	files: PlannedFile[];
	/** The paths of every `conflict`, so a caller can report them without filtering. */
	conflicts: string[];
}

/** How `plan` treats files that exist. */
export interface PlanOptions {
	/** The folder every path is relative to, and that no path may leave. */
	root: string;
	/** Replace files that exist instead of reporting them as conflicts. @default false */
	force?: boolean;
}

/**
 * Plans `files` under `options.root`. A path that is absolute, empty or leaves the root fails,
 * as do two files with the same path, since one would silently overwrite the other.
 *
 * @example await blueprint.plan([{ path: "app/flags/beta.ts", content }], { root: process.cwd() })
 */
export async function plan(
	files: readonly FileToWrite[],
	options: PlanOptions,
): Promise<Result<Plan, BlueprintError>> {
	let planned: PlannedFile[] = [];
	let seen = new Map<string, string | undefined>();
	for (let file of files) {
		let location = { source: file.source };
		let path = posix.normalize(file.path.replaceAll("\\", "/"));
		if (file.path.trim() === "" || path === ".") {
			return failure(new BlueprintError("A file has an empty path", location));
		}
		if (isAbsolute(file.path) || path === ".." || path.startsWith("../")) {
			return failure(
				new BlueprintError(
					`${file.path} is outside ${options.root}; paths are relative to it`,
					location,
				),
			);
		}
		if (seen.has(path)) {
			let other = seen.get(path);
			let by = other === undefined ? "another file" : other;
			return failure(new BlueprintError(`${path} is also written by ${by}`, location));
		}
		seen.set(path, file.source);
		let exists = isSuccess(await wrap(() => stat(resolve(options.root, path))));
		let action: Action = "create";
		if (exists) action = options.force === true ? "replace" : "conflict";
		planned.push({ path, content: file.content, action });
	}
	let conflicts = planned.filter((file) => file.action === "conflict").map((file) => file.path);
	return success({ root: options.root, files: planned, conflicts });
}

/**
 * Writes every file of `plan`, creating folders as needed. A plan with conflicts fails before
 * anything is written; a file created since planning fails rather than being overwritten.
 *
 * @returns The paths written, in plan order
 */
export async function write(plan: Plan): Promise<Result<string[], BlueprintError>> {
	if (plan.conflicts.length > 0) {
		return failure(new BlueprintError(`These files exist already: ${plan.conflicts.join(", ")}`));
	}
	let written: string[] = [];
	for (let file of plan.files) {
		let target = resolve(plan.root, file.path);
		let done = await wrap(async () => {
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, file.content, { flag: file.action === "create" ? "wx" : "w" });
		});
		if (!isSuccess(done)) {
			return failure(new BlueprintError(`Could not write ${file.path}: ${done.error.message}`));
		}
		written.push(file.path);
	}
	return success(written);
}
