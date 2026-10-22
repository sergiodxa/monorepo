/**
 * Shared setup plan: every path a feature will write or edit, printed before confirmation so
 * `--dry-run` is the default agent path until `-y` asks to write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import { unifiedDiff } from "../diff.js";

/** One new file the plan writes. */
export interface SetupFile {
	path: string;
	content: string;
}

/** One existing file the plan edits. */
export interface SetupEdit {
	path: string;
	before: string;
	after: string;
}

/** The full plan for one `sdxc setup <feature>` run. */
export interface SetupPlan {
	feature: string;
	provider: string | null;
	files: SetupFile[];
	edits: SetupEdit[];
	/** Packages to add as `workspace:*` / dated pins when missing. */
	dependencies: string[];
	notes: string[];
}

/** Prints the plan as the operator and agent read it. */
export function formatPlan(plan: SetupPlan): string {
	let lines = [
		`setup ${plan.feature}${plan.provider === null ? "" : ` --provider ${plan.provider}`}`,
	];
	for (let file of plan.files) lines.push(`  write ${file.path}`);
	for (let edit of plan.edits) lines.push(`  edit ${edit.path}`);
	for (let dependency of plan.dependencies) lines.push(`  depend ${dependency}`);
	for (let note of plan.notes) lines.push(`  note ${note}`);
	return `${lines.join("\n")}\n`;
}

/** Writes the plan's files and edits; under `dryRun` prints diffs and changes nothing. */
export async function applyPlan(
	root: string,
	plan: SetupPlan,
	options: { dryRun: boolean; stdout: (text: string) => void },
): Promise<Result<void, Error>> {
	if (options.dryRun) {
		options.stdout(formatPlan(plan));
		for (let file of plan.files) {
			options.stdout(unifiedDiff(file.path, null, file.content));
		}
		for (let edit of plan.edits) {
			options.stdout(unifiedDiff(edit.path, edit.before, edit.after));
		}
		return success(undefined);
	}
	for (let file of plan.files) {
		let target = join(root, file.path);
		if (isSuccess(await wrap(() => access(target)))) {
			return failure(
				new Error(`${file.path} already exists; refuse to overwrite a hand-edited file`),
			);
		}
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, file.content);
		options.stdout(`wrote ${file.path}\n`);
	}
	for (let edit of plan.edits) {
		await writeFile(join(root, edit.path), edit.after);
		options.stdout(`edited ${edit.path}\n`);
	}
	for (let note of plan.notes) options.stdout(`${note}\n`);
	return success(undefined);
}

/** Reads a project file, or fails naming the path. */
export async function readProjectFile(root: string, path: string): Promise<Result<string, Error>> {
	let source = await wrap(() => readFile(join(root, path), "utf8"));
	if (isFailure(source)) return failure(new Error(`No ${path} in the project`));
	return success(source.data);
}
