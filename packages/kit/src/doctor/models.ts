/**
 * The `models` check: every module in `app/models/` that creates a model is registered in
 * `app/models/index.ts`, since `ctx.models` reaches only what `createModels({ … })` lists and an
 * unregistered model is invisible to every request, job and command.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";

import { findModuleReferences } from "@sdxc/codemod";
import { isFailure, wrap } from "@sdxc/result";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/** The registry module `sdxc make model` adds each model to. */
export const MODELS_INDEX = "app/models/index.ts";

/** A `createModel(` call, which is what makes a module a model rather than a helper beside one. */
const CREATES_MODEL = /\bcreateModel\s*\(/;

/** A module extension a specifier may carry or leave out. */
const EXTENSION = /\.[cm]?[jt]sx?$/;

/** Warns on each model module the registry imports neither statically nor on first use. */
export const modelsCheck: Check = {
	name: "models",
	async run(context): Promise<CheckResult> {
		let index = await wrap(() => readFile(join(context.root, MODELS_INDEX), "utf8"));
		if (isFailure(index)) return skipped(`No ${MODELS_INDEX} in the project`);
		let references = findModuleReferences(MODELS_INDEX, index.data);
		if (isFailure(references)) return skipped(`${MODELS_INDEX} could not be read`);
		let registered = new Set(
			references.data.map(({ specifier }) => modulePath(specifier)).filter((path) => path !== null),
		);
		let models: string[] = [];
		for (let file of (await listFiles(context.root, "app/models")).filter(isAppSource)) {
			if (file === MODELS_INDEX) continue;
			let source = await wrap(() => readFile(join(context.root, file), "utf8"));
			if (isFailure(source) || !CREATES_MODEL.test(source.data)) continue;
			models.push(file);
		}
		let missing = models.filter((file) => {
			let bare = file.replace(EXTENSION, "");
			return !registered.has(bare) && !registered.has(bare.replace(/\/index$/, ""));
		});
		if (missing.length === 0) {
			return passed(`${MODELS_INDEX} registers every model in app/models/`);
		}
		return {
			status: "warn",
			message: `${MODELS_INDEX} leaves out ${missing.length === 1 ? "a model" : `${missing.length} models`}`,
			findings: missing.map((file) => `${file} creates a model ${MODELS_INDEX} does not import`),
			fix: `Register each in createModels({ … }) in ${MODELS_INDEX} as key: () => import("./<file>")`,
		};
	},
};

/**
 * The project path, extension removed, that a specifier written in the registry names, through
 * a relative path or the `~/app` alias; `null` for a package.
 */
function modulePath(specifier: string): string | null {
	let path: string;
	if (specifier.startsWith("~/app/")) path = specifier.slice(2);
	else if (specifier.startsWith(".")) path = posix.join("app/models", specifier);
	else return null;
	return posix.normalize(path).replace(EXTENSION, "");
}
