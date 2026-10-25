/**
 * The `constant-names` check: a module-level `const` holding a value is named in
 * `UPPER_SNAKE_CASE`, so a reader tells a module's data from its functions at the use site.
 * Exports are public names chosen for callers, and a call's result may be a service, so both are left out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SourceFinding, SourceRule } from "./source-rule.js";
import type { SyntaxNode } from "./syntax.js";

import { sourceCheck } from "./source-rule.js";
import { isNode, lineAt, parseModule } from "./syntax.js";

/** A name in `UPPER_SNAKE_CASE`. */
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/** Constructors whose instance is a value the module holds, as a literal is. */
const VALUE_CONSTRUCTORS = new Set(["Set", "Map", "WeakSet", "WeakMap", "RegExp", "URL", "Date"]);

/** Expressions that only annotate the value they wrap. */
const WRAPPERS = new Set(["TSAsExpression", "TSSatisfiesExpression", "ParenthesizedExpression"]);

/** Function expressions, which make a property a member function rather than data. */
const FUNCTIONS = new Set(["FunctionExpression", "ArrowFunctionExpression"]);

/** Every non-exported module-level `const` whose value is a literal, named in another case. */
export const CONSTANT_NAMES_RULE: SourceRule = {
	name: "constant-names",
	tests: true,
	find: findConstantNames,
	passed: "Every module-level constant value is named in UPPER_SNAKE_CASE",
	noun: ["constant not in UPPER_SNAKE_CASE", "constants not in UPPER_SNAKE_CASE"],
	fix: "Rename it in UPPER_SNAKE_CASE; functions and objects of functions keep camelCase",
};

/** Warns on each module-level constant value whose name is not `UPPER_SNAKE_CASE`. */
export const constantNamesCheck = sourceCheck(CONSTANT_NAMES_RULE);

/** Each top-level, non-exported `const` in `source` holding a literal value under another case. */
export function findConstantNames(file: string, source: string): SourceFinding[] {
	let parsed = parseModule(file, source);
	if (parsed === null) return [];
	let findings: SourceFinding[] = [];
	for (let statement of nodes(parsed.program.body)) {
		if (statement.type !== "VariableDeclaration" || statement.kind !== "const") continue;
		if (statement.declare === true) continue;
		for (let declarator of nodes(statement.declarations)) {
			let id = declarator.id;
			if (!isNode(id) || id.type !== "Identifier" || typeof id.name !== "string") continue;
			if (UPPER_SNAKE.test(id.name) || !isValue(declarator.init)) continue;
			findings.push({
				line: lineAt(source, declarator.start),
				message: `${id.name} holds a value; name it ${toUpperSnake(id.name)}`,
			});
		}
	}
	return findings;
}

/** `name` in `UPPER_SNAKE_CASE`: `maxRetries` is `MAX_RETRIES`. */
export function toUpperSnake(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toUpperCase();
}

/**
 * Whether `init` is data: a literal, template, array, object of non-function members, or a
 * `Set`, `Map`, `RegExp`, `URL` or `Date` built in place.
 */
function isValue(init: unknown): boolean {
	let node = unwrap(init);
	if (node === null) return false;
	switch (node.type) {
		case "Literal":
		case "TemplateLiteral":
		case "ArrayExpression":
			return true;
		case "UnaryExpression":
			return isNode(node.argument) && node.argument.type === "Literal";
		case "ObjectExpression":
			return nodes(node.properties).every(isDataMember);
		case "NewExpression":
			return isNode(node.callee) && VALUE_CONSTRUCTORS.has(String(node.callee.name));
		default:
			return false;
	}
}

/** An object member that holds data: a spread, or a property whose value is not a function. */
function isDataMember(member: SyntaxNode): boolean {
	if (member.type === "SpreadElement") return true;
	if (member.type !== "Property" || member.method === true || member.kind !== "init") return false;
	let value = unwrap(member.value);
	return value !== null && !FUNCTIONS.has(value.type);
}

/** `value` without the type assertions and parentheses around it. */
function unwrap(value: unknown): SyntaxNode | null {
	let node = isNode(value) ? value : null;
	while (node !== null && WRAPPERS.has(node.type)) {
		node = isNode(node.expression) ? node.expression : null;
	}
	return node;
}

/** The nodes in a list field of a node. */
function nodes(value: unknown): SyntaxNode[] {
	return Array.isArray(value) ? value.filter(isNode) : [];
}
