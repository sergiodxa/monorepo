/**
 * The `module-size` check: every app-source module stays within the configured code-line budget
 * (default 200), counting like `sdxc stats` so blank lines and comments do not inflate the size.
 * File-level size is outside oxlint's per-function rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { codeLines, PROJECT_FOLDERS } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/**
 * Warns on each module whose code lines exceed `doctor.moduleSize.maxLines`.
 */
export const moduleSizeCheck: Check = {
	name: "module-size",
	async run(context): Promise<CheckResult> {
		let max = context.config.doctor.moduleSize.maxLines;
		let findings: string[] = [];
		let files = 0;
		for (let folder of PROJECT_FOLDERS) {
			for (let file of (await listFiles(context.root, folder)).filter(isAppSource)) {
				files += 1;
				let source = await wrap(() => readFile(join(context.root, file), "utf8"));
				if (isFailure(source)) continue;
				let lines = codeLines(source.data, false);
				if (lines <= max) continue;
				findings.push(`${file}: ${lines} code lines (max ${max})`);
			}
		}
		if (files === 0) return skipped("No app source to measure module size");
		if (findings.length === 0) {
			return passed(`Every module stays within ${max} code lines`);
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 module above the size limit"
					: `Found ${findings.length} modules above the size limit`,
			findings,
			fix: `Extract helpers or split the module, or raise doctor.moduleSize.maxLines in .config/sdxc.jsonc`,
		};
	},
};
