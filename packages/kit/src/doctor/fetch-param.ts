/**
 * The `fetch-param` check: code calls the global `fetch`, and tests intercept it with MSW. A
 * `typeof fetch` parameter or option threads a second way to reach the network through every
 * caller, and lets a test pass against a stub that answers differently from the real client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SourceFinding, SourceRule } from "./source-rule.js";

import { sourceCheck } from "./source-rule.js";
import { isNode, lineAt, parseModule, walk } from "./syntax.js";

/** Every `typeof fetch` type in app code, the shape an injected fetch is declared with. */
export const FETCH_PARAM_RULE: SourceRule = {
	name: "fetch-param",
	tests: false,
	find: findFetchParams,
	passed: "App code calls the global fetch",
	noun: ["injected fetch", "injected fetches"],
	fix: "Call the global fetch directly and mock it in tests with MSW",
};

/** Warns on each `typeof fetch` in app code. */
export const fetchParamCheck = sourceCheck(FETCH_PARAM_RULE);

/** Each `typeof fetch` type query in `source`. */
export function findFetchParams(file: string, source: string): SourceFinding[] {
	let parsed = parseModule(file, source);
	if (parsed === null) return [];
	let findings: SourceFinding[] = [];
	walk(parsed.program, (node) => {
		if (node.type !== "TSTypeQuery") return;
		let name = node.exprName;
		if (!isNode(name) || name.type !== "Identifier" || name.name !== "fetch") return;
		findings.push({ line: lineAt(source, node.start), message: "typeof fetch" });
	});
	return findings;
}
