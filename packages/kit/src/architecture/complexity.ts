/**
 * Cyclomatic complexity per function, from an oxc AST walk: each decision point adds one to a
 * base of one, so a straight-line function scores 1 and an `if` raises it to 2. Doctor and CRAP
 * both read this so the same function never gets two answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseSync } from "oxc-parser";

/** One function (or method) and the cyclomatic complexity of its body. */
export interface FunctionComplexity {
	/** Human-readable name: `name`, `Class.method`, or `(anonymous)`. */
	name: string;
	/** 1-based line the function starts on. */
	line: number;
	/** McCabe cyclomatic complexity of the function body. */
	complexity: number;
}

/** A node the walker recognises as holding a nested AST. */
interface AstNode {
	type: string;
	start?: number;
	end?: number;
	name?: string;
	key?: AstNode | null;
	id?: AstNode | null;
	value?: AstNode | null;
	body?: AstNode | AstNode[] | null;
	params?: AstNode[];
	operator?: string;
	test?: AstNode | null;
	consequent?: AstNode | null;
	alternate?: AstNode | null;
	expression?: AstNode | null;
	callee?: AstNode | null;
	object?: AstNode | null;
	property?: AstNode | null;
	left?: AstNode | null;
	right?: AstNode | null;
	argument?: AstNode | null;
	arguments?: AstNode[];
	elements?: Array<AstNode | null>;
	properties?: AstNode[];
	declarations?: AstNode[];
	init?: AstNode | null;
	update?: AstNode | null;
	discriminant?: AstNode | null;
	cases?: AstNode[];
	block?: AstNode | null;
	handler?: AstNode | null;
	finalizer?: AstNode | null;
	superClass?: AstNode | null;
	declaration?: AstNode | null;
	specifiers?: AstNode[];
	source?: AstNode | null;
	kind?: string;
	static?: boolean;
	computed?: boolean;
	[key: string]: unknown;
}

/** Node types that open a function whose body is measured on its own. */
const FUNCTION_TYPES = new Set([
	"FunctionDeclaration",
	"FunctionExpression",
	"ArrowFunctionExpression",
	"TSDeclareFunction",
]);

/**
 * Every function in `source` with its cyclomatic complexity. A file oxc cannot parse yields an
 * empty list so the type checker, not doctor, names the syntax error.
 *
 * @param filename - Path reported for language detection (`.ts` / `.tsx`).
 * @param source - Module text.
 */
export function measureComplexity(filename: string, source: string): FunctionComplexity[] {
	let parsed = parseSync(filename, source);
	if (parsed.errors.length > 0 && parsed.program.body.length === 0) return [];
	let findings: FunctionComplexity[] = [];
	visit(parsed.program as unknown as AstNode, source, findings, null);
	return findings;
}

/**
 * Walks `node`, recording each function and descending into nested ones without double-counting
 * a method's `FunctionExpression` under its `MethodDefinition`.
 */
function visit(
	node: AstNode | null | undefined,
	source: string,
	findings: FunctionComplexity[],
	className: string | null,
): void {
	if (node == null || typeof node !== "object" || typeof node.type !== "string") return;

	if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
		let name = node.id?.name ?? className;
		for (let child of children(node)) visit(child, source, findings, name ?? null);
		return;
	}

	if (node.type === "MethodDefinition" || node.type === "PropertyDefinition") {
		let method = methodName(node, className);
		if (node.value && FUNCTION_TYPES.has(node.value.type)) {
			recordFunction(node.value, source, findings, method);
			return;
		}
		for (let child of children(node)) visit(child, source, findings, className);
		return;
	}

	if (node.type === "Property" && node.value && FUNCTION_TYPES.has(node.value.type)) {
		recordFunction(node.value, source, findings, propertyName(node) ?? "(anonymous)");
		return;
	}

	if (FUNCTION_TYPES.has(node.type)) {
		recordFunction(node, source, findings, functionName(node, className));
		return;
	}

	for (let child of children(node)) visit(child, source, findings, className);
}

/** Records one function and walks nested functions inside its body. */
function recordFunction(
	node: AstNode,
	source: string,
	findings: FunctionComplexity[],
	name: string,
): void {
	if (node.type === "TSDeclareFunction" || node.body == null) return;
	findings.push({
		name,
		line: lineOf(source, node.start ?? 0),
		complexity: complexityOf(node),
	});
	for (let child of children(node.body as AstNode)) visit(child, source, findings, null);
	for (let param of node.params ?? []) visit(param, source, findings, null);
}

/**
 * McCabe complexity of `node`'s own body: nested functions contribute their entry edge only
 * through separate records, not through this count.
 */
export function complexityOf(node: AstNode): number {
	let score = 1;
	walkDecisions(node.body ?? node, (decision) => {
		score += decision;
	});
	return score;
}

/** Visits decision points inside `node`, skipping nested function boundaries. */
function walkDecisions(
	node: AstNode | AstNode[] | null | undefined,
	add: (n: number) => void,
): void {
	if (node == null) return;
	if (Array.isArray(node)) {
		for (let child of node) walkDecisions(child, add);
		return;
	}
	if (typeof node !== "object" || typeof node.type !== "string") return;
	if (FUNCTION_TYPES.has(node.type)) return;

	switch (node.type) {
		case "IfStatement":
		case "ForStatement":
		case "ForInStatement":
		case "ForOfStatement":
		case "WhileStatement":
		case "DoWhileStatement":
		case "CatchClause":
		case "ConditionalExpression":
			add(1);
			break;
		case "SwitchCase":
			if (node.test != null) add(1);
			break;
		case "LogicalExpression":
			if (node.operator === "&&" || node.operator === "||" || node.operator === "??") add(1);
			break;
		default:
			break;
	}

	for (let child of children(node)) walkDecisions(child, add);
}

/** Direct child nodes, skipping location metadata. */
function children(node: AstNode): AstNode[] {
	let result: AstNode[] = [];
	for (let [key, value] of Object.entries(node)) {
		if (key === "type" || key === "start" || key === "end" || key === "range" || key === "loc") {
			continue;
		}
		if (Array.isArray(value)) {
			for (let item of value) {
				if (item && typeof item === "object" && typeof (item as AstNode).type === "string") {
					result.push(item as AstNode);
				}
			}
		} else if (value && typeof value === "object" && typeof (value as AstNode).type === "string") {
			result.push(value as AstNode);
		}
	}
	return result;
}

function functionName(node: AstNode, className: string | null): string {
	if (node.id?.name) {
		return className ? `${className}.${node.id.name}` : node.id.name;
	}
	return "(anonymous)";
}

function methodName(node: AstNode, className: string | null): string {
	let key = propertyName(node) ?? "(anonymous)";
	let prefix = node.static ? "static " : "";
	let kind = node.kind === "get" || node.kind === "set" ? `${node.kind} ` : "";
	let full = `${prefix}${kind}${key}`;
	return className ? `${className}.${full}` : full;
}

function propertyName(node: AstNode): string | null {
	let key = node.key;
	if (!key) return null;
	if (key.type === "Identifier") return key.name ?? null;
	if (key.type === "PrivateIdentifier") return `#${key.name ?? ""}`;
	if (key.type === "Literal") {
		let literal = key as unknown as { value?: unknown };
		if (typeof literal.value === "string") return literal.value;
	}
	return null;
}

/** 1-based line of `index` in `source`. */
function lineOf(source: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index && i < source.length; i++) {
		if (source.charCodeAt(i) === 10) line += 1;
	}
	return line;
}
