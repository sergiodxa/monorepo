/**
 * Where `sdxc ci` finds its script: the nearest project at or above the current directory whose
 * `ci.script` (`.config/sdxc/ci.ts` by default) exists. Run from a workspace below that project,
 * the run is scoped to the workspace, so `sdxc ci` inside one app checks that app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import { loadConfig } from "../config.js";
import { findProjectRoot } from "../project.js";

/** The project a CI run belongs to. */
export interface CIProject {
	/** The directory holding the script's project, where its commands run. */
	root: string;
	/** The script's absolute path. */
	script: string;
	/** The workspace the run started in, relative to `root`; `null` at the root itself. */
	workspace: string | null;
}

/** Whether `path` is a file. */
async function isFile(path: string): Promise<boolean> {
	let found = await wrap(() => stat(path));
	return isSuccess(found) && found.data.isFile();
}

/**
 * The CI project for a run started in `cwd`. Each project from `cwd` upward is asked for its
 * configured script; reaching the filesystem root without one is a failure naming the default.
 */
export async function locateCI(cwd: string): Promise<Result<CIProject, Error>> {
	let start = await findProjectRoot(cwd);
	if (isFailure(start)) return start;
	let directory = start.data;
	while (true) {
		let config = await loadConfig(directory);
		if (isFailure(config)) return config;
		let script = join(directory, config.data.config.ci.script);
		if (await isFile(script)) {
			let workspace = relative(directory, start.data).split(sep).join("/");
			return success({ root: directory, script, workspace: workspace === "" ? null : workspace });
		}
		let parent = await findProjectRoot(dirname(directory));
		if (isFailure(parent) || parent.data === directory) {
			return failure(
				new Error(
					`No CI script at or above ${resolve(cwd)}; write one at .config/sdxc/ci.ts, or set ci.script in .config/sdxc.jsonc`,
				),
			);
		}
		directory = parent.data;
	}
}
