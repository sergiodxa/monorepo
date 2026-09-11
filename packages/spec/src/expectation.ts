/**
 * Assertion semantics: the two `expect` forms (value truthiness/equality and
 * observable tools) and the `eventually` retry loop. The executor drives this
 * module through the `ExpectationHost` seam, so expression evaluation and
 * tool dispatch stay in the executor while the assertion rules live here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { ArgumentNode, EventuallyNode, ExpectNode, ExpressionNode } from "./ast.js";
import type { Registry, ResolvedCallable } from "./registry.js";
import type { Span } from "./source.js";
import type { Value } from "./values.js";

import { ExpectationError, ResolutionError, SpecError, ToolError } from "./errors.js";
import { formatValue, valueEquals } from "./values.js";

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
	/**
	 * Evaluate one expression in the enclosing scope. A bare path whose head is
	 * unbound dispatches as a zero-argument call, so this is asynchronous and
	 * every attempt of an `eventually` re-reads what the call observes.
	 */
	evaluate(expression: ExpressionNode): Promise<Result<Value, SpecError>>;
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

/** The word that inverts an assertion, valid only as `expect`'s first argument. */
const NOT_WORD = "not";

/** The word that selects the containment form of the value `expect`. */
const CONTAINS_WORD = "contains";

/** Which `expect` form the first argument selected. */
type ExpectMode =
	| { mode: "value" }
	| { mode: "observable"; tool: Extract<ResolvedCallable, { kind: "tool" }> };

/**
 * One resolved `expect`, ready to run as many times as `eventually` needs:
 * whether it is inverted, which form it takes, and the arguments after any
 * leading `not`, whose first is the subject.
 */
interface ExpectPlan {
	/** Whether a leading `not` inverts whatever the form concluded. */
	negated: boolean;
	/** The form the subject selected. */
	mode: ExpectMode;
	/** The arguments from the subject onward. */
	args: ArgumentNode[];
	/** The whole statement, for anchoring failures. */
	span: Span;
}

/**
 * The failure for a `not` written anywhere but as `expect`'s first argument.
 *
 * @param span - Where the stray word sits.
 * @returns The usage error to report.
 */
export function strayNotError(span: Span): SpecError {
	return anchor(
		new SpecError(
			"usage-error",
			`"${NOT_WORD}" inverts an assertion, so it is only valid as the first argument to expect`,
		),
		span,
	);
}

/**
 * Execute one `expect` statement. A leading `not` inverts whatever follows,
 * and the subject decides the form: bound and callable is `ambiguous-name`, a
 * bound name (or literal) is the value form, an observable tool is the
 * observable form.
 *
 * @param node - The `expect` statement to execute.
 * @param host - The executor-provided scope, registry, and dispatch seam.
 * @returns Success when the assertion held, otherwise the structured failure.
 */
export async function executeExpect(
	node: ExpectNode,
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	let plan = planExpect(node, host);
	if (isFailure(plan)) return plan;
	return runExpect(plan.data, host);
}

/**
 * Resolve one `expect` down to a runnable plan. Every name resolves here, so
 * `eventually` pays for resolution once and retries only the observation.
 */
function planExpect(node: ExpectNode, host: ExpectationHost): Result<ExpectPlan, SpecError> {
	let args = node.args;
	let negated = false;
	let first = args[0];
	if (first?.kind === "word" && first.word === NOT_WORD) {
		negated = true;
		args = args.slice(1);
	}
	let head = args[0];
	if (head === undefined) {
		return failure(
			anchor(
				new SpecError(
					"usage-error",
					negated
						? `expect ${NOT_WORD} needs something to invert`
						: "expect needs at least one argument",
				),
				node.span,
			),
		);
	}
	for (let argument of args) {
		if (argument.kind === "word" && argument.word === NOT_WORD) {
			return failure(strayNotError(argument.span));
		}
	}
	let resolved = resolveExpectMode(head, host);
	if (isFailure(resolved)) return resolved;
	return success({ negated, mode: resolved.data, args, span: node.span });
}

/**
 * Run one resolved plan; `eventually` calls this once per attempt. Arguments
 * are evaluated here rather than in the plan, so an attempt re-reads whatever
 * a nested zero-argument call observes.
 */
async function runExpect(
	plan: ExpectPlan,
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	if (plan.mode.mode === "observable") return executeObservableExpect(plan, plan.mode.tool, host);
	return executeValueExpect(plan, host);
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
			let plan = planExpect(statement, host);
			if (isFailure(plan)) return plan;
			let resolved = plan.data;
			attempts.push(() => runExpect(resolved, host));
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
 * The value form: `expect A` asserts truthiness, `expect A B` deep structural
 * equality, and `expect A contains B` substring or membership. A leading `not`
 * inverts whichever of the three the arguments selected.
 */
async function executeValueExpect(
	plan: ExpectPlan,
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	let head = plan.args[0];
	if (head === undefined) {
		return failure(
			anchor(new SpecError("usage-error", "expect needs at least one argument"), plan.span),
		);
	}
	let rest = plan.args.slice(1);
	let separator = rest[0];
	if (separator?.kind === "word" && separator.word === CONTAINS_WORD) {
		return executeContainsExpect(plan, head, rest.slice(1), host);
	}
	if (rest.length > 1) {
		return failure(
			anchor(
				new SpecError(
					"usage-error",
					"value-form expect takes at most two arguments: a value and an optional expected value",
				),
				plan.span,
			),
		);
	}
	let observed = await evaluateValueArgument(head, host);
	if (isFailure(observed)) return observed;
	let expectedArgument = rest[0];
	if (expectedArgument === undefined) {
		if (Boolean(observed.data) !== plan.negated) return success(undefined);
		return failure(
			anchor(
				new ExpectationError(
					`Expected ${plan.negated ? "a falsy" : "a truthy"} value, observed ${formatValue(observed.data)}`,
					undefined,
					observed.data,
				),
				plan.span,
			),
		);
	}
	let expected = await evaluateValueArgument(expectedArgument, host);
	if (isFailure(expected)) return expected;
	if (valueEquals(observed.data, expected.data) !== plan.negated) return success(undefined);
	return failure(
		anchor(
			new ExpectationError(
				plan.negated
					? `Expected anything other than ${formatValue(expected.data)}, observed it`
					: `Expected ${formatValue(expected.data)}, observed ${formatValue(observed.data)}`,
				expected.data,
				observed.data,
			),
			plan.span,
		),
	);
}

/**
 * `expect A contains B`: a substring of a string, or a member of an array
 * under the same structural equality the two-argument form uses.
 */
async function executeContainsExpect(
	plan: ExpectPlan,
	head: ArgumentNode,
	rest: ArgumentNode[],
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	let [wantedArgument] = rest;
	if (wantedArgument === undefined || rest.length > 1) {
		return failure(
			anchor(
				new SpecError("usage-error", `expect ${CONTAINS_WORD} takes exactly one value to look for`),
				plan.span,
			),
		);
	}
	let observed = await evaluateValueArgument(head, host);
	if (isFailure(observed)) return observed;
	let wanted = await evaluateValueArgument(wantedArgument, host);
	if (isFailure(wanted)) return wanted;
	let held = valueContains(observed.data, wanted.data);
	if (isFailure(held)) return failure(anchor(held.error, plan.span));
	if (held.data !== plan.negated) return success(undefined);
	return failure(
		anchor(
			new ExpectationError(
				`Expected ${formatValue(observed.data)} ${plan.negated ? "not to contain" : "to contain"} ${formatValue(wanted.data)}`,
				wanted.data,
				observed.data,
			),
			plan.span,
		),
	);
}

/** Containment over the two types that have one: strings and arrays. */
function valueContains(observed: Value, wanted: Value): Result<boolean, SpecError> {
	if (typeof observed === "string") {
		if (typeof wanted !== "string") {
			return failure(
				new SpecError(
					"usage-error",
					`${CONTAINS_WORD} looks for a string inside a string, and was given ${describeType(wanted)}`,
				),
			);
		}
		return success(observed.includes(wanted));
	}
	if (Array.isArray(observed)) {
		return success(observed.some((item) => valueEquals(item, wanted)));
	}
	return failure(
		new SpecError(
			"usage-error",
			`${CONTAINS_WORD} reads a string or an array, and observed ${describeType(observed)}`,
		),
	);
}

/** Name a value's type for a diagnostic, the way a reader would name it. */
function describeType(value: Value): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "an array";
	if (typeof value === "object") return "an object";
	return `a ${typeof value}`;
}

/**
 * The observable form: call the tool with the remaining arguments. A plain
 * `false` return becomes an expectation failure, and under `not` the tool
 * declining to hold is what passes — a denied permission still propagates, so
 * a missing grant is never read as the thing being absent.
 */
async function executeObservableExpect(
	plan: ExpectPlan,
	tool: Extract<ResolvedCallable, { kind: "tool" }>,
	host: ExpectationHost,
): Promise<Result<undefined, SpecError>> {
	let result = await host.callTool(tool, plan.args.slice(1), plan.span);
	if (isFailure(result)) {
		if (!plan.negated || result.error.code === "permission-denied") {
			return failure(anchor(result.error, plan.span));
		}
		return success(undefined);
	}
	let held = result.data !== false;
	if (held !== plan.negated) return success(undefined);
	return failure(
		anchor(
			new ExpectationError(
				`Expected ${qualifiedName(tool)} ${plan.negated ? "not to hold, observed that it does" : "to hold, observed false"}`,
				!plan.negated,
				held,
			),
			plan.span,
		),
	);
}

/**
 * Evaluate one argument as a value: expressions evaluate in the scope, and a
 * bare word reads the binding of the same spelling — words are only symbolic
 * when a tool receives them.
 */
async function evaluateValueArgument(
	argument: ArgumentNode,
	host: ExpectationHost,
): Promise<Result<Value, SpecError>> {
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
