/**
 * The `result-throws` check: app source does not `throw`. Errors travel as `@sdxc/result`
 * failures so handlers stay typed; a bare throw is a convention the project strays from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { tokenize } from "@sdxc/codemod";
import { isFailure, wrap } from "@sdxc/result";

import { PROJECT_FOLDERS } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/**
 * Warns on each `throw` statement in app source. Tests and declaration files are left out by
 * {@link isAppSource}.
 */
export const resultThrowsCheck: Check = {
	name: "result-throws",
	async run(context): Promise<CheckResult> {
		let findings: string[] = [];
		let files = 0;
		for (let folder of PROJECT_FOLDERS) {
			for (let file of (await listFiles(context.root, folder)).filter(isAppSource)) {
				files += 1;
				let source = await wrap(() => readFile(join(context.root, file), "utf8"));
				if (isFailure(source)) continue;
				for (let line of throwLines(file, source.data)) {
					findings.push(`${file}:${line}: throw`);
				}
			}
		}
		if (files === 0) return skipped("No app source to scan for throw");
		if (findings.length === 0) {
			return passed("App source returns Result failures instead of throw");
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 throw in app source"
					: `Found ${findings.length} throws in app source`,
			findings,
			fix: "Return failure(...) from @sdxc/result (or a typed error) instead of throw",
		};
	},
};

/**
 * 1-based lines where `throw` appears as an identifier token (not inside a string or comment).
 */
export function throwLines(file: string, source: string): number[] {
	let tokens = tokenize(file, source);
	if (isFailure(tokens)) return [];
	let lines: number[] = [];
	for (let token of tokens.data) {
		if (token.type !== "identifier" || token.value !== "throw") continue;
		lines.push(lineOf(source, token.start));
	}
	return lines;
}

function lineOf(source: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index && i < source.length; i++) {
		if (source.charCodeAt(i) === 10) line += 1;
	}
	return line;
}
