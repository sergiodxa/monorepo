/**
 * The `crap` check: CRAP scores from cyclomatic complexity and Istanbul coverage stay at or
 * under the configured maximum (default 12). Without a coverage report the check skips, since a
 * score without coverage would only restate complexity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { measureComplexity } from "../architecture/complexity.js";
import { coverageExists, loadCoverage, scoreFunctions } from "../architecture/crap.js";
import { PROJECT_FOLDERS } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/**
 * Warns on each function whose CRAP score exceeds `doctor.crap.max` when coverage data is
 * present at `doctor.crap.coverage`.
 */
export const crapCheck: Check = {
	name: "crap",
	async run(context): Promise<CheckResult> {
		let { max, coverage: coverageFile } = context.config.doctor.crap;
		if (!(await coverageExists(context.root, coverageFile))) {
			return skipped(`No coverage at ${coverageFile}; run tests with coverage then re-run doctor`);
		}
		let coverage = await loadCoverage(context.root, coverageFile);
		let findings: string[] = [];
		let scored = 0;
		for (let folder of PROJECT_FOLDERS) {
			for (let file of (await listFiles(context.root, folder)).filter(isAppSource)) {
				let source = await wrap(() => readFile(join(context.root, file), "utf8"));
				if (isFailure(source)) continue;
				let functions = measureComplexity(file, source.data);
				for (let entry of scoreFunctions(file, functions, coverage)) {
					if (entry.crap === null) continue;
					scored += 1;
					if (entry.crap <= max) continue;
					let pct = entry.coverage === null ? "?" : `${Math.round(entry.coverage * 100)}%`;
					findings.push(
						`${entry.file}:${entry.line}: ${entry.name} CRAP ${formatCrap(entry.crap)} (cc ${entry.complexity}, cov ${pct}, max ${max})`,
					);
				}
			}
		}
		if (scored === 0) {
			return skipped(
				`Coverage at ${coverageFile} matches no app functions; generate coverage for app source`,
			);
		}
		if (findings.length === 0) {
			return passed(`Every scored function stays at CRAP ${max} or below`);
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 function above the CRAP limit"
					: `Found ${findings.length} functions above the CRAP limit`,
			findings,
			fix: `Lower complexity, raise coverage, or raise doctor.crap.max in .config/sdxc.jsonc`,
		};
	},
};

/** One decimal place when the score is not an integer. */
function formatCrap(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
