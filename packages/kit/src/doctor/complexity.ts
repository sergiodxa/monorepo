/**
 * The `complexity` check: every function's cyclomatic complexity stays at or under the
 * configured maximum (default 4), so agent-written branches stay small enough to test and
 * review. Oxlint's `complexity` rule is left off; this check is project-aware and configurable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { measureComplexity } from "../architecture/complexity.js";
import { PROJECT_FOLDERS } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/**
 * Warns on each function whose cyclomatic complexity exceeds `doctor.complexity.max`.
 */
export const complexityCheck: Check = {
	name: "complexity",
	async run(context): Promise<CheckResult> {
		let max = context.config.doctor.complexity.max;
		let findings: string[] = [];
		let files = 0;
		for (let folder of PROJECT_FOLDERS) {
			for (let file of (await listFiles(context.root, folder)).filter(isAppSource)) {
				files += 1;
				let source = await wrap(() => readFile(join(context.root, file), "utf8"));
				if (isFailure(source)) continue;
				for (let fn of measureComplexity(file, source.data)) {
					if (fn.complexity <= max) continue;
					findings.push(
						`${file}:${fn.line}: ${fn.name} has complexity ${fn.complexity} (max ${max})`,
					);
				}
			}
		}
		if (files === 0) return skipped("No app source to measure complexity");
		if (findings.length === 0) {
			return passed(`Every function stays at cyclomatic complexity ${max} or below`);
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 function above the cyclomatic complexity limit"
					: `Found ${findings.length} functions above the cyclomatic complexity limit`,
			findings,
			fix: `Split each function so its decision points stay at ${max} or fewer, or raise doctor.complexity.max in .config/sdxc.jsonc`,
		};
	},
};
