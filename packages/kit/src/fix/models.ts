/**
 * `sdxc fix models`: registers every `createModel` module under `app/models/` that
 * `app/models/index.ts` leaves out, through the same codemod `sdxc make model` uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";

import type { Result } from "@sdxc/result";

import { findModuleReferences } from "@sdxc/codemod";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import { unifiedDiff } from "../diff.js";
import { isAppSource, listFiles } from "../doctor/files.js";
import { MODELS_INDEX } from "../doctor/models.js";
import { declare } from "../make/declare.js";
import { parseName } from "../make/names.js";

/** A module extension a specifier may carry or leave out. */
const EXTENSION = /\.[cm]?[jt]sx?$/;

/** A `createModel(` call, which is what makes a module a model rather than a helper beside one. */
const CREATES_MODEL = /\bcreateModel\s*\(/;

/** One registration the fix applies. */
export interface ModelFix {
	file: string;
	diffs: string[];
}

/**
 * Registers each unregistered model module. Refuses a file whose declaration cannot be placed
 * automatically, naming the manual instructions.
 */
export async function fixModels(
	root: string,
	options: { dryRun: boolean },
): Promise<Result<ModelFix[], Error>> {
	let missing = await unregisteredModels(root);
	if (isFailure(missing)) return missing;
	if (missing.data.length === 0) return success([]);
	let fixed: ModelFix[] = [];
	for (let file of missing.data) {
		let relative = file.replace(EXTENSION, "");
		let segments = relative.replace(/^app\/models\//, "");
		let name = parseName(segments);
		if (isFailure(name)) return name;
		let declared = await declare(
			{
				kind: "model",
				name: name.data,
				variant: null,
				method: "get",
				routes: "web",
				handler: relative,
				tool: name.data.snake,
				uri: "",
				title: name.data.title,
			},
			root,
		);
		if (declared.kind === "manual") {
			return failure(
				new Error(
					`Cannot register ${file} automatically (${declared.reason}):\n${declared.instructions}`,
				),
			);
		}
		let diffs: string[] = [];
		for (let edit of declared.edits) {
			diffs.push(unifiedDiff(edit.path, edit.before, edit.after));
			if (!options.dryRun) await writeFile(join(root, edit.path), edit.after);
		}
		fixed.push({ file, diffs });
	}
	return success(fixed);
}

/** Model modules under `app/models/` that `createModels` does not import. */
async function unregisteredModels(root: string): Promise<Result<string[], Error>> {
	let index = await wrap(() => readFile(join(root, MODELS_INDEX), "utf8"));
	if (isFailure(index)) return failure(new Error(`No ${MODELS_INDEX} in the project`));
	let references = findModuleReferences(MODELS_INDEX, index.data);
	if (isFailure(references)) return failure(new Error(`${MODELS_INDEX} could not be read`));
	let registered = new Set(
		references.data.map(({ specifier }) => modulePath(specifier)).filter((path) => path !== null),
	);
	let models: string[] = [];
	for (let file of (await listFiles(root, "app/models")).filter(isAppSource)) {
		if (file === MODELS_INDEX) continue;
		let source = await wrap(() => readFile(join(root, file), "utf8"));
		if (isFailure(source) || !CREATES_MODEL.test(source.data)) continue;
		let bare = file.replace(EXTENSION, "");
		if (!registered.has(bare) && !registered.has(bare.replace(/\/index$/, ""))) {
			models.push(file);
		}
	}
	return success(models);
}

/** Project path a registry specifier names, or `null` for a package. */
function modulePath(specifier: string): string | null {
	let path: string;
	if (specifier.startsWith("~/app/")) path = specifier.slice(2);
	else if (specifier.startsWith(".")) path = posix.join("app/models", specifier);
	else return null;
	return posix.normalize(path).replace(EXTENSION, "");
}
