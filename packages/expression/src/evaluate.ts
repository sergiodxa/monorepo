/**
 * Whether a compiled expression holds for a context. Synchronous and pure: the
 * compiled tree already carries every pattern and reference, so evaluation is
 * a walk over it and a path read per operand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Node } from "./grammar.js";

import { BUILTINS, comparedPath, EXISTS } from "./builtins.js";
import { ExpressionError, joinPath } from "./expression-error.js";
import { read } from "./read.js";

/** A node's answer: a boolean, or in a strict language the failure that decided it. */
export type Answer = boolean | ExpressionError;

/**
 * Answers whether `node` holds. A lenient language answers `false` for a leaf
 * reading a missing path, `null` across two paths, or operands of the wrong
 * type; a strict one answers a failure, which `all`, `any` and `not` combine
 * in three-valued logic so swapping operands never changes the answer.
 *
 * @param grammar The language that compiled the node.
 * @param node A node as `compile` returned it.
 * @param context The object the expression reads.
 * @returns A boolean, or a failure whose `path` names the node from `node`.
 */
export function evaluate(grammar: Grammar, node: Node, context: object): Answer {
	switch (node.op) {
		case "all":
			return combine(grammar, node.of as Node[], context, false);
		case "any":
			return combine(grammar, node.of as Node[], context, true);
		case "not": {
			let answer = evaluate(grammar, node.of as Node, context);
			return typeof answer === "boolean" ? !answer : under("of", answer);
		}
		case "always":
			return true;
	}

	if (node.op === grammar.reference) {
		let answer = evaluate(grammar, node.of as Node, context);
		if (typeof answer === "boolean") return answer;
		return new ExpressionError(answer.message, { ...details(answer), cause: answer });
	}

	return leaf(grammar, node, context);
}

/**
 * Evaluates the members of an `all` (deciding on `false`) or an `any`
 * (deciding on `true`), stopping at the first deciding member. Without one, a
 * failed member makes the whole a failure.
 */
function combine(grammar: Grammar, of: Node[], context: object, decides: boolean): Answer {
	let failed: ExpressionError | undefined;
	for (let index = 0; index < of.length; index++) {
		let answer = evaluate(grammar, of[index] as Node, context);
		if (answer === decides) return decides;
		if (typeof answer !== "boolean") failed ??= under(`of.${index}`, answer);
	}
	return failed ?? !decides;
}

/**
 * Answers a field operator. `exists` reads absence itself; every other
 * operator needs both operands present, and a built-in also needs them of
 * types it compares.
 */
function leaf(grammar: Grammar, node: Node, context: object): Answer {
	let { strict } = grammar;
	let operator = grammar.fields.get(node.op);
	if (operator === undefined) return false;

	let field = node.field as string;
	let value = read(context, field);
	if (operator === EXISTS) return value !== undefined;
	if (value === undefined) return strict ? missing(field, "field") : false;

	let builtin = BUILTINS.get(operator);
	if (builtin === undefined) return operator.test(value, node);

	let path = comparedPath(operator, node);
	if (path === undefined) {
		if (!strict) return operator.test(value, node);
		let literal = node[builtin.key];
		return builtin.compare(value, literal) ?? mismatch(node.op, value, literal, "");
	}

	let other = read(context, path);
	if (other === undefined) return strict ? missing(path, "path") : false;
	if (value === null || other === null) {
		return strict ? mismatch(node.op, value, other, value === null ? "field" : "path") : false;
	}
	return builtin.compare(value, other) ?? (strict ? mismatch(node.op, value, other, "") : false);
}

/** The failure for a context path that resolved to nothing, at the node field naming it. */
function missing(path: string, at: "field" | "path"): ExpressionError {
	return new ExpressionError(`Context has no "${path}"`, { path: at, missing: path });
}

/** The failure for operands an operator does not compare, naming both types. */
function mismatch(op: string, left: unknown, right: unknown, at: string): ExpressionError {
	let types = [kind(left), kind(right)] as const;
	let message = `"${op}" cannot compare ${types[0]} with ${types[1]}`;
	return new ExpressionError(message, { path: at, mismatch: types });
}

/** Names an operand's type the way a person writing JSON reads it. */
function kind(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (value instanceof Date) return "date";
	if (value instanceof RegExp) return "string";
	return typeof value;
}

/** Re-roots a member's failure under the composing node, so its `path` names it from the root. */
function under(segment: string, error: ExpressionError): ExpressionError {
	return new ExpressionError(error.message, {
		...details(error),
		path: joinPath(segment, error.path),
		cause: error.cause,
	});
}

/** What a failure says about the context, carried along when it is re-rooted. */
function details(error: ExpressionError): {
	missing?: string;
	mismatch?: readonly [string, string];
} {
	let { missing: path, mismatch: types } = error;
	return {
		...(path === undefined ? {} : { missing: path }),
		...(types === undefined ? {} : { mismatch: types }),
	};
}
