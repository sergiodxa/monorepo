/**
 * The `process-env` check: app code reads its bindings and secrets from `env` in
 * `cloudflare:workers`, which `cloudflare.config.ts` declares and typegen types. `process.env`
 * holds none of them in a deployed Worker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SourceFinding, SourceRule } from "./source-rule.js";

import { sourceCheck } from "./source-rule.js";
import { isNode, lineAt, parseModule, walk } from "./syntax.js";

/** Every `process.env` read in app code; tests set up their environment as they need. */
export const PROCESS_ENV_RULE: SourceRule = {
	name: "process-env",
	tests: false,
	find: findProcessEnv,
	passed: "App code reads env from cloudflare:workers",
	noun: ["process.env read", "process.env reads"],
	fix: 'Read the binding from env, imported from "cloudflare:workers"',
};

/** Warns on each `process.env` read in app code. */
export const processEnvCheck = sourceCheck(PROCESS_ENV_RULE);

/** Each `process.env` member access in `source`. */
export function findProcessEnv(file: string, source: string): SourceFinding[] {
	let parsed = parseModule(file, source);
	if (parsed === null) return [];
	let findings: SourceFinding[] = [];
	walk(parsed.program, (node) => {
		if (node.type !== "MemberExpression") return;
		let { object, property } = node;
		if (!isNode(object) || object.type !== "Identifier" || object.name !== "process") return;
		if (!isNode(property) || property.name !== "env") return;
		findings.push({ line: lineAt(source, node.start), message: "reads process.env" });
	});
	return findings;
}
