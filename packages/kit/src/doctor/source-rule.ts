/**
 * A source rule: one convention the project's modules follow, found per file by `find`, and the
 * `sdxc doctor` check that reads every module in the app layout's folders for it. A rule is plain
 * data, so a monorepo check can run the same `find` over folders outside one app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { PROJECT_FOLDERS } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, isModule, listFiles } from "./files.js";

/** One place a module breaks a rule. */
export interface SourceFinding {
	/** The 1-based line it starts on. */
	line: number;
	/** What breaks the rule, short enough to follow `file:line:` in the report. */
	message: string;
}

/** A convention every module of the project follows. */
export interface SourceRule {
	/** The check's name in the report and for `--only` and `--skip`. */
	name: string;
	/** Whether tests follow the rule too; app code always does. */
	tests: boolean;
	/** Each place `source` breaks the rule; a module oxc cannot parse yields none. */
	find(file: string, source: string): SourceFinding[];
	/** The report's message when no module breaks the rule. */
	passed: string;
	/** The noun for one finding and for many, as in "Found 2 local consts". */
	noun: [one: string, many: string];
	/** The edit that clears a finding. */
	fix: string;
}

/** Whether `rule` reads `file`: a module, and app code unless the rule covers tests. */
export function appliesTo(rule: SourceRule, file: string): boolean {
	return rule.tests ? isModule(file) : isAppSource(file);
}

/** The `sdxc doctor` check that warns on every finding of `rule` across the app layout's folders. */
export function sourceCheck(rule: SourceRule): Check {
	return {
		name: rule.name,
		async run(context): Promise<CheckResult> {
			let findings: string[] = [];
			let files = 0;
			for (let folder of PROJECT_FOLDERS) {
				for (let file of await listFiles(context.root, folder)) {
					if (!appliesTo(rule, file)) continue;
					files += 1;
					let source = await wrap(() => readFile(join(context.root, file), "utf8"));
					if (isFailure(source)) continue;
					for (let found of rule.find(file, source.data)) {
						findings.push(`${file}:${found.line}: ${found.message}`);
					}
				}
			}
			if (files === 0) return skipped("No app source to read");
			if (findings.length === 0) return passed(rule.passed);
			let [one, many] = rule.noun;
			return {
				status: "warn",
				message: `Found ${findings.length} ${findings.length === 1 ? one : many}`,
				findings,
				fix: rule.fix,
			};
		},
	};
}
