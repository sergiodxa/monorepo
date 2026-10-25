/**
 * The `stack-imports` check: the project imports the library its stack settled on for each
 * concern, so validation, UI and markup each have one way to be written: `remix/data-schema`
 * for schemas, `remix/component` JSX for UI and server HTML, and `css()` mixins for styles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SourceFinding, SourceRule } from "./source-rule.js";

import { sourceCheck } from "./source-rule.js";
import { isNode, lineAt, parseModule, walk } from "./syntax.js";

/** A replaced library's specifiers and what the project uses in its place. */
interface Replacement {
	/** Matches the specifier and its subpaths. */
	specifier: RegExp;
	use: string;
}

/** Each replaced library, matched on the import's specifier. */
const REPLACEMENTS: readonly Replacement[] = [
	{ specifier: /^zod(?:\/|$)/, use: "remix/data-schema" },
	{
		specifier: /^(?:react|react-dom|react-router|@remix-run\/react|preact)(?:\/|$)/,
		use: "remix/component",
	},
	{ specifier: /^(?:tailwindcss|@tailwindcss\/[^/]+)(?:\/|$)/, use: "css() mixins" },
	{ specifier: /^remix\/html-template(?:\/|$)/, use: "remix/component JSX rendered on the server" },
];

/** Nodes whose `source` names the module they load. */
const LOADS = new Set([
	"ImportDeclaration",
	"ImportExpression",
	"ExportNamedDeclaration",
	"ExportAllDeclaration",
]);

/** Every import, re-export or dynamic `import()` of a replaced library, tests included. */
export const STACK_IMPORTS_RULE: SourceRule = {
	name: "stack-imports",
	tests: true,
	find: findStackImports,
	passed: "Every import uses the stack's library for its concern",
	noun: ["import of a replaced library", "imports of replaced libraries"],
	fix: "Import the library named in each finding instead",
};

/** Warns on each import of a library the stack replaces. */
export const stackImportsCheck = sourceCheck(STACK_IMPORTS_RULE);

/** Each place `source` loads a replaced library, with the library to use instead. */
export function findStackImports(file: string, source: string): SourceFinding[] {
	let parsed = parseModule(file, source);
	if (parsed === null) return [];
	let findings: SourceFinding[] = [];
	walk(parsed.program, (node) => {
		if (!LOADS.has(node.type) || !isNode(node.source)) return;
		let specifier = node.source.value;
		if (typeof specifier !== "string") return;
		let replacement = REPLACEMENTS.find((entry) => entry.specifier.test(specifier));
		if (replacement === undefined) return;
		findings.push({
			line: lineAt(source, node.start),
			message: `imports ${specifier}; use ${replacement.use}`,
		});
	});
	return findings;
}
