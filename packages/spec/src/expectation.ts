/**
 * Assertion semantics: the two `expect` forms (value truthiness/equality and
 * observable tools) and the `eventually` retry loop. The executor drives this
 * module through the `ExpectationHost` seam, so expression evaluation and
 * tool dispatch stay in the executor while the assertion rules live here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, isSuccess, success } from "@pkg/result";

import type { ArgumentNode, EventuallyNode, ExpectNode, ExpressionNode } from "./ast";
import type { Registry, ResolvedCallable } from "./registry";
import type { Span } from "./source";
import type { Value } from "./values";

import { ExpectationError, ResolutionError, SpecError, ToolError } from "./errors";
import { formatValue, valueEquals } from "./values";

/** Deadline of an `eventually` block with no `within` clause, in milliseconds. */
export const DEFAULT_EVENTUALLY_MS = 5000;

/** Pause between `eventually` attempts, in milliseconds. */
export const POLL_INTERVAL_MS = 100;

/**
 * What `expect` and `eventually` need from their caller: the enclosing scope
 * for binding lookups, the suite's resolution table, and the executor's
 * dispatch seam, which owns argument evaluation and the central permission gate.
 */
export interface ExpectationHost {
	/** The enclosing scope, for binding lookups and ambiguity detection. */
	scope: Map<string, Value>;
	/** The suite's name-resolution table. */
	registry: Registry;
	/** Namespaces imported by the calling file, in `use` order. */
	uses: readonly string[];
	/** Evaluate one expression in the enclosing scope. */
	evaluate(expression: ExpressionNode): Result<Value, SpecError>;
	/**
	 * Invoke a resolved tool with raw argument nodes. The implementation owns
	 * argument evaluation and the runtime's central permission gate.
	 */
	callTool(
		tool: Extract<ResolvedCallable, { kind: "tool" }>,
		args: ArgumentNode[],
		span: Span,
	): Promise<Result<Value, SpecError>>;
}

/** Which `expect` form the first argument selected. */
type ExpectMode =
	| { mode: "value" }
	| { mode: "observable"; tool: Extract<ResolvedCallable, { kind: "tool" }> };

/**
 * Execute one `expect` statement. The first argument decides the form: bound
 * and callable is `ambiguous-name`, a bound name (or literal) selects the
 * value form, and a callable observable tool selects the observable form.
 *
 * @param node - The `expect` statement to execute.
 * @param host - The executor-provided scope, registry, and dispatch seam.
 * @returns Success when the assertion held, otherwise the structured failure.
 */
export async function executeExpect(
	node: ExpectNode,
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	let head = node.args[0];
	if (head === undefined) {
		return failure(
			anchor(new SpecError("usage-error", "expect needs at least one argument"), node.span),
		);
	}
	let resolved = resolveExpectMode(head, host);
	if (isFailure(resolved)) return resolved;
	if (resolved.data.mode === "observable") {
		return executeObservableExpect(node, resolved.data.tool, host);
	}
	return executeValueExpect(node, head, host);
}

/**
 * Execute one `eventually` block: only `expect` statements and observable
 * calls may appear, since a retried mutation is not a retried assertion. Every
 * name resolves once before the first attempt, because `let` is banned inside the block.
 *
 * @param node - The `eventually` statement to execute.
 * @param host - The executor-provided scope, registry, and dispatch seam.
 * @returns Success once an attempt fully passed, otherwise the last failure.
 */
export async function executeEventually(
	node: EventuallyNode,
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	let attempts: Array<() => Promise<Result<undefined, SpecError>>> = [];
	for (let statement of node.block.statements) {
		if (statement.kind === "expect") {
			let expectNode = statement;
			let head = expectNode.args[0];
			if (head === undefined) {
				return failure(
					anchor(
						new SpecError("usage-error", "expect needs at least one argument"),
						expectNode.span,
					),
				);
			}
			let headArgument = head;
			let resolved = resolveExpectMode(headArgument, host);
			if (isFailure(resolved)) return resolved;
			let mode = resolved.data;
			if (mode.mode === "observable") {
				let tool = mode.tool;
				attempts.push(() => executeObservableExpect(expectNode, tool, host));
			} else {
				attempts.push(async () => executeValueExpect(expectNode, headArgument, host));
			}
			continue;
		}
		if (statement.kind === "call") {
			let callNode = statement;
			let resolved = host.registry.resolveCallable(callNode.target, host.uses);
			if (isFailure(resolved)) return failure(anchor(resolved.error, callNode.span));
			if (resolved.data.kind !== "tool" || resolved.data.descriptor.kind !== "observable") {
				return failure(
					anchor(
						new SpecError(
							"usage-error",
							`Only expect statements and observable calls may appear inside eventually; "${callNode.target}" is not an observable`,
						),
						callNode.span,
					),
				);
			}
			let tool = resolved.data;
			attempts.push(async () => {
				let result = await host.callTool(tool, callNode.args, callNode.span);
				if (isFailure(result)) return failure(anchor(result.error, callNode.span));
				/**
				 * A bare observable is still an assertion: `false` fails the
				 * attempt exactly as it fails the expect form of the same call.
				 */
				if (result.data === false) {
					return failure(
						anchor(
							new ExpectationError(
								`Expected ${qualifiedName(tool)} to hold, observed false`,
								true,
								false,
							),
							callNode.span,
						),
					);
				}
				return success(undefined);
			});
			continue;
		}
		return failure(
			anchor(
				new SpecError(
					"usage-error",
					`Only expect statements and observable calls may appear inside eventually; found a ${statement.kind} statement`,
				),
				statement.span,
			),
		);
	}
	let deadline = Date.now() + (node.withinMs ?? DEFAULT_EVENTUALLY_MS);
	while (true) {
		let error = await runAttempt(attempts);
		if (error === undefined) return success(undefined);
		if (Date.now() >= deadline) return failure(anchor(error, node.span));
		await sleep(POLL_INTERVAL_MS);
	}
}

/** Run one full attempt of an `eventually` block; the first failure ends it. */
async function runAttempt(
	attempts: Array<() => Promise<Result<undefined, SpecError>>>,
): Promise<SpecError | undefined> {
	for (let attempt of attempts) {
		let result = await attempt();
		if (isFailure(result)) return result.error;
	}
	return undefined;
}

/**
 * Decide which `expect` form the first argument selects. Words and
 * one-segment references are treated alike: bound and callable is ambiguous,
 * bound alone is the value form, callable alone must be an observable tool.
 */
function resolveExpectMode(
	head: ArgumentNode,
	host: ExpectationHost,
): Result<ExpectMode, SpecError> {
	let name: string;
	let headBinding: string;
	if (head.kind === "word") {
		name = head.word;
		headBinding = head.word;
	} else if (head.kind === "reference") {
		let first = head.path[0];
		if (first === undefined) {
			return failure(
				anchor(
					new ResolutionError("unknown-name", "expect received an empty reference"),
					head.span,
				),
			);
		}
		name = head.path.join(".");
		headBinding = first;
	} else {
		return success({ mode: "value" });
	}
	let bound = host.scope.has(headBinding);
	let resolved = host.registry.resolveCallable(name, host.uses);
	if (bound && isSuccess(resolved)) {
		return failure(
			anchor(
				new ResolutionError(
					"ambiguous-name",
					`"${name}" is both a binding and a callable; the runtime never guesses — rename the binding or qualify the tool`,
					[qualifiedName(resolved.data)],
				),
				head.span,
			),
		);
	}
	if (bound) return success({ mode: "value" });
	if (isSuccess(resolved)) {
		if (resolved.data.kind !== "tool" || resolved.data.descriptor.kind !== "observable") {
			return failure(
				anchor(
					new ToolError(
						`"${qualifiedName(resolved.data)}" is not an observable; only observable tools can head an expect`,
					),
					head.span,
				),
			);
		}
		return success({ mode: "observable", tool: resolved.data });
	}
	return failure(anchor(resolved.error, head.span));
}

/**
 * The value form: `expect A` asserts truthiness, `expect A B` asserts deep
 * structural equality, anything longer is a usage error.
 */
function executeValueExpect(
	node: ExpectNode,
	head: ArgumentNode,
	host: ExpectationHost,
): Result<undefined, SpecError> {
	if (node.args.length > 2) {
		return failure(
			anchor(
				new SpecError(
					"usage-error",
					"value-form expect takes at most two arguments: a value and an optional expected value",
				),
				node.span,
			),
		);
	}
	let observed = evaluateValueArgument(head, host);
	if (isFailure(observed)) return observed;
	let expectedArgument = node.args[1];
	if (expectedArgument === undefined) {
		if (observed.data) return success(undefined);
		return failure(
			anchor(
				new ExpectationError(
					`Expected a truthy value, observed ${formatValue(observed.data)}`,
					undefined,
					observed.data,
				),
				node.span,
			),
		);
	}
	let expected = evaluateValueArgument(expectedArgument, host);
	if (isFailure(expected)) return expected;
	if (valueEquals(observed.data, expected.data)) return success(undefined);
	return failure(
		anchor(
			new ExpectationError(
				`Expected ${formatValue(expected.data)}, observed ${formatValue(observed.data)}`,
				expected.data,
				observed.data,
			),
			node.span,
		),
	);
}

/**
 * The observable form: call the tool with the remaining arguments; its own
 * failure propagates, and a plain `false` return becomes an expectation
 * failure.
 */
async function executeObservableExpect(
	node: ExpectNode,
	tool: Extract<ResolvedCallable, { kind: "tool" }>,
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	let result = await host.callTool(tool, node.args.slice(1), node.span);
	if (isFailure(result)) return failure(anchor(result.error, node.span));
	if (result.data === false) {
		return failure(
			anchor(
				new ExpectationError(
					`Expected ${qualifiedName(tool)} to hold, observed false`,
					true,
					false,
				),
				node.span,
			),
		);
	}
	return success(undefined);
}

/**
 * Evaluate one argument as a value: expressions evaluate in the scope, and a
 * bare word reads the binding of the same spelling — words are only symbolic
 * when a tool receives them.
 */
function evaluateValueArgument(
	argument: ArgumentNode,
	host: ExpectationHost,
): Result<Value, SpecError> {
	if (argument.kind !== "word") return host.evaluate(argument);
	if (!host.scope.has(argument.word)) {
		return failure(
			anchor(
				new ResolutionError(
					"unknown-name",
					`Unknown name "${argument.word}" — nothing is bound under it`,
				),
				argument.span,
			),
		);
	}
	return success(host.scope.get(argument.word) ?? null);
}

/** The fully qualified spelling of a resolved callable, for diagnostics. */
function qualifiedName(callable: ResolvedCallable): string {
	if (callable.kind === "tool") return `${callable.namespace}.${callable.descriptor.name}`;
	return callable.command.name;
}

/** Stamp a span onto an error that does not carry one yet. */
function anchor(error: SpecError, span: Span): SpecError {
	if (error.span === undefined) error.span = span;
	return error;
}

/** Resolve after the given pause, for the `eventually` poll loop. */
function sleep(milliseconds: number): Promise<undefined> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(undefined), milliseconds);
	});
}
