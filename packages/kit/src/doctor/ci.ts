/**
 * The `ci` check: the project's CI script loads and gives every step a name of its own.
 * `--only`, `--skip` and a CI host's job matrix address steps by name, so two steps sharing
 * one would run, skip or fail together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";

import { loadScript, runScript } from "@sdxc/ci";
import { isFailure, isSuccess, wrap } from "@sdxc/result";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/**
 * Fails when the script cannot load or two steps share an address (a name, prefixed by its
 * matrix entry inside a matrix); skips a project without a script. Steps are listed the way
 * `sdxc ci list` lists them, so nothing runs.
 */
export const ciCheck: Check = {
	name: "ci",
	async run(context): Promise<CheckResult> {
		let path = context.config.ci.script;
		let found = await wrap(() => stat(join(context.root, path)));
		if (!isSuccess(found) || !found.data.isFile()) return skipped(`No CI script at ${path}`);
		let loaded = await loadScript(join(context.root, path), context.root);
		if (isFailure(loaded)) {
			return {
				status: "fail",
				message: `${path} does not load as a CI script`,
				findings: [loaded.error.message],
				fix: "Default-export defineCI(async (ci) => { … }) from @sdxc/ci, and install @sdxc/ci",
			};
		}
		let listed = await runScript(loaded.data, {
			root: context.root,
			dryRun: true,
			runner: "local",
		});
		let duplicates = duplicateLabels(listed.steps.map((step) => step.label));
		let errors = listed.errors.map(
			(error) => `${error.where ?? "the script"} threw: ${error.message.split("\n")[0]}`,
		);
		if (errors.length > 0 || duplicates.length > 0) {
			return {
				status: "fail",
				message: `${path} has steps --only and --skip cannot tell apart, or throws while listing`,
				findings: [...duplicates.map((label) => `"${label}" names more than one step`), ...errors],
				fix: "Give each step its own name, such as one including the workspace it checks",
			};
		}
		return passed(`${path} loads, and each of its ${listed.steps.length} steps has its own name`);
	},
};

/** Every label that occurs more than once, in first-seen order. */
function duplicateLabels(labels: readonly string[]): string[] {
	let seen = new Set<string>();
	let repeated = new Set<string>();
	for (let label of labels) {
		if (seen.has(label)) repeated.add(label);
		seen.add(label);
	}
	return [...repeated];
}
