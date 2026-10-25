/**
 * The `local-const` check: `const` declares module-level constants only, and every binding inside
 * a function or block is `let`. A reader then knows a `const` is shared by the whole module and
 * named for it, and a local binding reads the same whether or not it is reassigned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SourceFinding, SourceRule } from "./source-rule.js";
import type { SyntaxNode } from "./syntax.js";

import { sourceCheck } from "./source-rule.js";
import { lineAt, parseModule, walk } from "./syntax.js";

/** Every `const` below the module's top level, tests included; ambient declarations are left out. */
export const LOCAL_CONST_RULE: SourceRule = {
	name: "local-const",
	tests: true,
	find: findLocalConsts,
	passed: "Every const is a module-level constant",
	noun: ["const inside a function or block", "consts inside a function or block"],
	fix: "Declare it with let, or move a true constant to the module's top level in UPPER_SNAKE_CASE",
};

/** Warns on each `const` declared inside a function or block. */
export const localConstCheck = sourceCheck(LOCAL_CONST_RULE);

/** Each `const` declaration nested in a function, class or block of `source`. */
export function findLocalConsts(file: string, source: string): SourceFinding[] {
	let parsed = parseModule(file, source);
	if (parsed === null) return [];
	let findings: SourceFinding[] = [];
	walk(parsed.program, (node, ancestors) => {
		if (node.type !== "VariableDeclaration" || node.kind !== "const") return;
		if (node.declare === true || ancestors.some(isAmbient) || ancestors.every(isTopLevel)) return;
		findings.push({
			line: lineAt(source, node.start),
			message: "const inside a function or block",
		});
	});
	return findings;
}

/** Nodes that keep a declaration at module level: a namespace's members are module members too. */
const MODULE_LEVEL = new Set([
	"Program",
	"ExportNamedDeclaration",
	"TSModuleDeclaration",
	"TSModuleBlock",
]);

/** A node that keeps a declaration at module level. */
function isTopLevel(node: SyntaxNode): boolean {
	return MODULE_LEVEL.has(node.type);
}

/** A `declare` module or namespace, whose members describe types rather than run. */
function isAmbient(node: SyntaxNode): boolean {
	return node.type === "TSModuleDeclaration" && node.declare === true;
}
