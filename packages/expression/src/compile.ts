/**
 * Turns an untrusted expression into the compiled tree evaluation walks:
 * validated against the language's schema, every operator's compile step run,
 * and every reference resolved once, with a cycle refused here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Grammar, Node } from "./grammar.js";

import { ExpressionError, joinPath } from "./expression-error.js";

/** What `compile` may be told beyond the expression itself. */
export interface CompileOptions {
	/**
	 * Shared expressions by name, which a reference node resolves against. The
	 * object is read as fixed: each name compiles once per object, so passing the
	 * same one to many compiles shares the resolved trees.
	 */
	references?: Readonly<Record<string, unknown>>;
}

/** The resolved references of every references object a language has compiled against. */
export type ReferenceCache = WeakMap<object, Map<string, Node>>;

/** One compile call's view of the references: the shared cache, and the chain being walked. */
interface Scope {
	grammar: Grammar;
	references: Readonly<Record<string, unknown>>;
	resolved: Map<string, Node>;
	visiting: Set<string>;
}

/**
 * Validates and compiles one expression.
 *
 * @param grammar The language compiling it.
 * @param input The expression as stored, validated by nobody yet.
 * @param options The references it may name.
 * @param cache Where resolved references are kept per references object.
 */
export function compile(
	grammar: Grammar,
	input: unknown,
	options: CompileOptions,
	cache: ReferenceCache,
): Result<Node, ExpressionError> {
	let parsed = validate(grammar.schema, input, "");
	if (isFailure(parsed)) return parsed;

	let references = options.references ?? {};
	let resolved = cache.get(references);
	if (resolved === undefined) {
		resolved = new Map();
		cache.set(references, resolved);
	}

	return compileNode({ grammar, references, resolved, visiting: new Set() }, parsed.data, "");
}

/**
 * Reads a value against the language's schema, reporting the first issue with
 * its path under `at`, the position the value sits at.
 */
export function validate(
	schema: Schema<unknown, Node>,
	value: unknown,
	at: string,
): Result<Node, ExpressionError> {
	let result = s.parseSafe(schema, value);
	if (result.success) return success(result.value);

	let issue = result.issues[0];
	let path = (issue?.path ?? []).reduce<string>(
		(joined, segment) =>
			joinPath(joined, String(typeof segment === "object" ? segment.key : segment)),
		at,
	);
	return failure(new ExpressionError(issue?.message ?? "Expected an expression", { path }));
}

/** Compiles one validated node and everything under it, naming failures by `path`. */
function compileNode(scope: Scope, node: Node, path: string): Result<Node, ExpressionError> {
	let { grammar } = scope;

	if (node.op === "all" || node.op === "any") {
		let of: Node[] = [];
		for (let [index, member] of (node.of as Node[]).entries()) {
			let compiled = compileNode(scope, member, joinPath(path, `of.${index}`));
			if (isFailure(compiled)) return compiled;
			of.push(compiled.data);
		}
		return success({ op: node.op, of });
	}

	if (node.op === "not") {
		let compiled = compileNode(scope, node.of as Node, joinPath(path, "of"));
		if (isFailure(compiled)) return compiled;
		return success({ op: "not", of: compiled.data });
	}

	if (node.op === "always") return success(node);

	if (node.op === grammar.reference) {
		let name = node.name as string;
		let resolved = resolve(scope, name, path);
		if (isFailure(resolved)) return resolved;
		return success({ op: node.op, name, of: resolved.data });
	}

	let operator = grammar.fields.get(node.op);
	if (operator === undefined) {
		return failure(new ExpressionError(`Unknown operator "${node.op}"`, { path }));
	}

	let compiled = operator.compile(node);
	if (isFailure(compiled)) return failure(atNode(compiled.error, path));
	return success(compiled.data);
}

/**
 * Resolves a reference to the expression it names, memoizing it so every node
 * naming it shares one compiled tree. `visiting` holds the chain being walked,
 * which turns a cycle into a failure instead of an endless walk.
 */
function resolve(scope: Scope, name: string, path: string): Result<Node, ExpressionError> {
	let already = scope.resolved.get(name);
	if (already !== undefined) return success(already);

	let spelling = scope.grammar.reference ?? "reference";
	if (scope.visiting.has(name)) {
		let label = spelling.charAt(0).toUpperCase() + spelling.slice(1);
		return failure(
			new ExpressionError(`${label} "${name}" takes part in a reference cycle`, { path }),
		);
	}

	if (!Object.hasOwn(scope.references, name)) {
		return failure(new ExpressionError(`Unknown ${spelling} "${name}"`, { path }));
	}

	let parsed = validate(scope.grammar.schema, scope.references[name], "");
	if (isFailure(parsed)) return failure(atReference(parsed.error, path));

	scope.visiting.add(name);
	let compiled = compileNode(scope, parsed.data, "");
	scope.visiting.delete(name);

	if (isFailure(compiled)) return failure(atReference(compiled.error, path));
	scope.resolved.set(name, compiled.data);
	return compiled;
}

/**
 * Names an operator's compile failure from the root: an `ExpressionError` the
 * operator raised keeps its own path beneath the node, like `pattern`.
 */
function atNode(error: Error, path: string): ExpressionError {
	if (!(error instanceof ExpressionError))
		return new ExpressionError(error.message, { path, cause: error });
	return new ExpressionError(error.message, {
		path: joinPath(path, error.path),
		cause: error.cause,
	});
}

/**
 * Reports a failure inside a referenced expression at the reference node,
 * since its own path is relative to a different document.
 */
function atReference(error: ExpressionError, path: string): ExpressionError {
	return new ExpressionError(error.message, { path, cause: error });
}
