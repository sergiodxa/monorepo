/**
 * The interpreter core of the runtime: executes one test's statements against
 * the suite registry, an isolated workspace, and the caller's grants. Owns
 * scopes, `let`/`return`, command and fixture invocation, and the central
 * permission gate that refuses denied permission families before a plugin
 * ever sees the call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type {
	ArgumentNode,
	CommandNode,
	DefinitionNode,
	ExpressionNode,
	ReferenceNode,
	RhsNode,
	StatementNode,
	TestNode,
} from "./ast";
import type { ExpectationHost } from "./expectation";
import type { Grants, PermissionKind, PermissionSet } from "./permissions";
import type { Registry, ResolvedCallable } from "./registry";
import type { Span } from "./source";
import type { ToolArg, Value, ValueObject } from "./values";
import type { Workspace } from "./workspace";

import { PermissionDeniedError, ResolutionError, SpecError, ToolError } from "./errors";
import { executeEventually, executeExpect } from "./expectation";

/** How deep command/fixture invocations may nest before a cycle is suspected. */
const MAX_CALL_DEPTH = 32;

/** Maps a permission family to its key in the {@link Grants} record. */
const GRANT_KEYS = {
	run: "run",
	net: "net",
	env: "env",
	"host-fs": "hostFs",
} as const satisfies Record<PermissionKind, keyof Grants>;

/**
 * Everything one test needs to execute: the suite's resolution table, its
 * isolated workspace, the caller's grants, and the namespaces its file
 * imported with `use`.
 */
export interface ExecutionContext {
	/** The suite's name-resolution table. */
	registry: Registry;
	/** The test's isolated workspace, handed to every tool call. */
	workspace: Workspace;
	/** The caller's grant set, handed to every tool call for scoped checks. */
	permissions: PermissionSet;
	/** Namespaces imported by the test's file, in `use` order. */
	uses: readonly string[];
	/**
	 * The namespaces imported by the file that DEFINED a command or fixture —
	 * `use` is file-scoped, so a definition's body resolves bare names against
	 * its own file's imports, never the caller's.
	 */
	usesFor: (definition: DefinitionNode) => readonly string[];
	/**
	 * The path of the file that DEFINED a command or fixture. Errors raised
	 * inside a definition's body carry the body's spans, so they must be
	 * anchored to the defining file — stamping the calling test's file would
	 * map those spans onto the wrong source text. When absent (or returning
	 * undefined), errors keep the calling file.
	 */
	fileFor?: (definition: DefinitionNode) => string | undefined;
	/**
	 * The parsed grant modes. The executor refuses calls to tools whose
	 * required permission family is denied outright, before the plugin runs;
	 * scoped refinement then happens inside the plugin through the
	 * runtime-owned `PermissionSet`.
	 */
	grants: Grants;
	/** Path of the file the test lives in, stamped onto every error. */
	file?: string;
}

/** The per-test execution services plus the current call depth. */
interface Environment extends ExecutionContext {
	/** Current command/fixture nesting depth, for the recursion cap. */
	depth: number;
}

/** How a statement sequence ended: ran to completion, or hit a `return`. */
type BlockOutcome = { kind: "completed" } | { kind: "returned"; value: Value };

/**
 * Execute one test. Its `given`, `when`, and `then` phases share a single
 * scope and run in order; the first failing statement ends the test. Every
 * error is stamped with the failing statement's span, and with the test's
 * file path when the context provides one, before it is returned.
 *
 * @param test - The test to execute.
 * @param context - The suite services and grants the test runs against.
 * @returns Success when every statement held, otherwise the first failure.
 */
export async function executeTest(
	test: TestNode,
	context: ExecutionContext,
): Promise<Result<undefined, SpecError>> {
	let scope = new Map<string, Value>();
	let environment: Environment = { ...context, depth: 0 };
	let phases = [test.given, test.when, test.then];
	for (let phase of phases) {
		if (phase === undefined) continue;
		let outcome = await executeStatements(phase.statements, scope, environment, false);
		if (isFailure(outcome)) return outcome;
	}
	return success(undefined);
}

/**
 * Run a statement sequence in order, anchoring every failure to the failing
 * statement, until it completes, returns, or fails.
 */
async function executeStatements(
	statements: StatementNode[],
	scope: Map<string, Value>,
	environment: Environment,
	allowReturn: boolean,
): Promise<Result<BlockOutcome, SpecError>> {
	for (let statement of statements) {
		let result = await executeStatement(statement, scope, environment, allowReturn);
		if (isFailure(result)) {
			return failure(anchor(result.error, statement.span, environment.file));
		}
		if (result.data.kind === "returned") return result;
	}
	return success({ kind: "completed" });
}

/** Dispatch one statement: let, return, call, expect, or eventually. */
async function executeStatement(
	statement: StatementNode,
	scope: Map<string, Value>,
	environment: Environment,
	allowReturn: boolean,
): Promise<Result<BlockOutcome, SpecError>> {
	if (statement.kind === "let") {
		if (scope.has(statement.name)) {
			return failure(
				new SpecError(
					"usage-error",
					`"${statement.name}" is already bound; let never rebinds a name`,
				),
			);
		}
		let value = await evaluateRhs(statement.value, scope, environment);
		if (isFailure(value)) return value;
		scope.set(statement.name, value.data);
		return success({ kind: "completed" });
	}
	if (statement.kind === "return") {
		if (!allowReturn) {
			return failure(
				new SpecError("usage-error", "return is only valid inside command and fixture bodies"),
			);
		}
		let value = await evaluateRhs(statement.value, scope, environment);
		if (isFailure(value)) return value;
		return success({ kind: "returned", value: value.data });
	}
	if (statement.kind === "call") {
		let result = await invokeCallable(
			statement.target,
			statement.args,
			statement.span,
			scope,
			environment,
		);
		if (isFailure(result)) return result;
		return success({ kind: "completed" });
	}
	if (statement.kind === "expect") {
		let result = await executeExpect(statement, makeHost(scope, environment));
		if (isFailure(result)) return result;
		return success({ kind: "completed" });
	}
	let result = await executeEventually(statement, makeHost(scope, environment));
	if (isFailure(result)) return result;
	return success({ kind: "completed" });
}

/** Evaluate a `let`/`return` right-hand side: expression, fixture, or call. */
async function evaluateRhs(
	rhs: RhsNode,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	if (rhs.kind === "fixture-call") return runFixture(rhs.name, rhs.span, environment);
	if (rhs.kind === "call-expr") {
		return invokeCallable(rhs.target, rhs.args, rhs.span, scope, environment);
	}
	if (rhs.kind === "reference") {
		let call = zeroArgToolCall(rhs, scope, environment);
		if (call !== undefined) return call;
	}
	return evaluateExpression(rhs, scope);
}

/**
 * A bare-path `let`/`return` right-hand side names the value to bind. Normally
 * that is a reference into the scope, but when its head is not a binding it may
 * instead name a zero-argument tool — `let current = browser.url` — whose
 * observed value is what the binding should hold. The resolution is
 * deliberately narrow and never guesses: a bound head is always a reference (a
 * binding and a tool cannot collide here, because a reference requires a bound
 * head), and the path is a call only when it resolves — honoring the file's
 * `use` — to a tool that requires no arguments. Anything else (an ambiguous or
 * unknown path, a command, a tool with required arguments) returns undefined so
 * the caller evaluates the reference normally and its unknown-name error still
 * stands. The call is dispatched through the ordinary tool path, so the
 * runtime's permission gate applies exactly as it does to a written call.
 */
function zeroArgToolCall(
	reference: ReferenceNode,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> | undefined {
	let head = reference.path[0];
	if (head === undefined || scope.has(head)) return undefined;
	let resolved = environment.registry.resolveCallable(reference.path.join("."), environment.uses);
	if (isFailure(resolved) || resolved.data.kind !== "tool") return undefined;
	if (resolved.data.descriptor.params.some((param) => param.required)) return undefined;
	return invokeTool(resolved.data, [], reference.span, scope, environment);
}

/** Evaluate one expression in the given scope. */
function evaluateExpression(
	expression: ExpressionNode,
	scope: Map<string, Value>,
): Result<Value, SpecError> {
	if (expression.kind === "string") return success(expression.value);
	if (expression.kind === "number") return success(expression.value);
	if (expression.kind === "boolean") return success(expression.value);
	if (expression.kind === "duration") return success(expression.milliseconds);
	if (expression.kind === "object") {
		let object: ValueObject = {};
		for (let entry of expression.entries) {
			let value = evaluateExpression(entry.value, scope);
			if (isFailure(value)) return value;
			object[entry.key] = value.data;
		}
		return success(object);
	}
	return resolveReference(expression, scope);
}

/**
 * Resolve a dotted reference: the head segment must be a binding and every
 * further segment a field of the value so far — a miss is an `unknown-name`
 * error, never `null`.
 */
function resolveReference(
	reference: ReferenceNode,
	scope: Map<string, Value>,
): Result<Value, SpecError> {
	let head = reference.path[0];
	if (head === undefined || !scope.has(head)) {
		return failure(
			anchor(
				new ResolutionError(
					"unknown-name",
					`Unknown name "${head ?? ""}" — nothing is bound under it`,
				),
				reference.span,
			),
		);
	}
	let current: Value = scope.get(head) ?? null;
	for (let index = 1; index < reference.path.length; index++) {
		let segment = reference.path[index];
		if (segment === undefined) continue;
		if (
			typeof current !== "object" ||
			current === null ||
			Array.isArray(current) ||
			!(segment in current)
		) {
			let prefix = reference.path.slice(0, index).join(".");
			return failure(
				anchor(
					new ResolutionError(
						"unknown-name",
						`Unknown field "${segment}" — "${prefix}" has no such field`,
					),
					reference.span,
				),
			);
		}
		current = current[segment] ?? null;
	}
	return success(current);
}

/** Resolve a call target and invoke the tool or command it names. */
async function invokeCallable(
	target: string,
	args: ArgumentNode[],
	span: Span,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	let resolved = environment.registry.resolveCallable(target, environment.uses);
	if (isFailure(resolved)) return failure(anchor(resolved.error, span, environment.file));
	if (resolved.data.kind === "tool") {
		return invokeTool(resolved.data, args, span, scope, environment);
	}
	return invokeCommand(resolved.data.command, args, span, scope, environment);
}

/**
 * Invoke one plugin tool: evaluate the arguments (words stay symbolic), pass
 * the central permission gate, then hand the call to the plugin with the
 * test's workspace and grants.
 */
async function invokeTool(
	tool: Extract<ResolvedCallable, { kind: "tool" }>,
	args: ArgumentNode[],
	span: Span,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	let toolArgs: ToolArg[] = [];
	for (let argument of args) {
		if (argument.kind === "word") {
			toolArgs.push({ kind: "word", word: argument.word });
			continue;
		}
		let value = evaluateExpression(argument, scope);
		if (isFailure(value)) return value;
		toolArgs.push({ kind: "value", value: value.data });
	}
	let gate = gateToolCall(tool, environment);
	if (isFailure(gate)) return failure(anchor(gate.error, span, environment.file));
	let result = await tool.plugin.call(tool.descriptor.name, toolArgs, {
		workspace: environment.workspace,
		permissions: environment.permissions,
	});
	if (isFailure(result)) return failure(anchor(result.error, span, environment.file));
	return result;
}

/**
 * The runtime's coarse permission gate: a tool whose required permission
 * family is denied outright never reaches its plugin — plugin self-restraint
 * is not load-bearing. Scoped refinement (which host? which binary?) happens
 * inside the plugin through the runtime-owned `PermissionSet`.
 */
function gateToolCall(
	tool: Extract<ResolvedCallable, { kind: "tool" }>,
	environment: Environment,
): Result<undefined, SpecError> {
	let required = tool.descriptor.requires;
	if (required === undefined) return success(undefined);
	let grant = environment.grants[GRANT_KEYS[required]];
	if (grant.mode !== "denied") return success(undefined);
	let qualified = `${tool.namespace}.${tool.descriptor.name}`;
	return failure(
		new PermissionDeniedError(required, qualified, `spec run --allow-${required}`, true),
	);
}

/**
 * Invoke one suite command: arguments are evaluated as values (a bare word
 * reads the caller's binding of that spelling), bound positionally to the
 * command's parameters in a fresh scope, and the body's `return` value — or
 * `null` when it never returns — is the call's value.
 */
async function invokeCommand(
	command: CommandNode,
	args: ArgumentNode[],
	span: Span,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	let values: Value[] = [];
	for (let argument of args) {
		let value = evaluateValueArgument(argument, scope);
		if (isFailure(value)) return value;
		values.push(value.data);
	}
	if (values.length !== command.params.length) {
		return failure(
			anchor(
				new SpecError(
					"usage-error",
					`Command "${command.name}" expects ${command.params.length} argument(s), got ${values.length}`,
				),
				span,
				environment.file,
			),
		);
	}
	let commandScope = new Map<string, Value>();
	for (let index = 0; index < command.params.length; index++) {
		let param = command.params[index];
		if (param === undefined) continue;
		commandScope.set(param, values[index] ?? null);
	}
	return runBody(command, commandScope, span, environment);
}

/** Run `fixture NAME`: a fresh, empty scope; the body runs on every call. */
async function runFixture(
	name: string,
	span: Span,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	let resolved = environment.registry.resolveFixture(name);
	if (isFailure(resolved)) return failure(anchor(resolved.error, span, environment.file));
	return runBody(resolved.data, new Map(), span, environment);
}

/**
 * Run a command or fixture body under the recursion cap; the body's `return`
 * value is the result, and a body that never returns produces `null`. Because
 * `use` is file-scoped, the body resolves bare names against the imports of
 * the file that defined it, not the caller's file — and errors raised inside
 * the body anchor to the defining file, so their spans map onto the source
 * text they came from.
 */
async function runBody(
	definition: DefinitionNode,
	scope: Map<string, Value>,
	span: Span,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	if (environment.depth >= MAX_CALL_DEPTH) {
		return failure(
			anchor(
				new ToolError(
					`Call depth exceeded ${MAX_CALL_DEPTH} while invoking ${definition.kind} "${definition.name}" — a command or fixture cycle is suspected`,
				),
				span,
				environment.file,
			),
		);
	}
	let nested: Environment = {
		...environment,
		depth: environment.depth + 1,
		uses: environment.usesFor(definition),
	};
	let definitionFile = environment.fileFor?.(definition);
	if (definitionFile !== undefined) nested.file = definitionFile;
	let outcome = await executeStatements(definition.body.statements, scope, nested, true);
	if (isFailure(outcome)) return outcome;
	if (outcome.data.kind === "returned") return success(outcome.data.value);
	return success(null);
}

/**
 * Evaluate one argument as a value: expressions evaluate in the scope, and a
 * bare word reads the binding of the same spelling — words are only symbolic
 * when a tool receives them.
 */
function evaluateValueArgument(
	argument: ArgumentNode,
	scope: Map<string, Value>,
): Result<Value, SpecError> {
	if (argument.kind !== "word") return evaluateExpression(argument, scope);
	if (!scope.has(argument.word)) {
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
	return success(scope.get(argument.word) ?? null);
}

/** The seam `expect`/`eventually` use to evaluate and dispatch through us. */
function makeHost(scope: Map<string, Value>, environment: Environment): ExpectationHost {
	return {
		scope,
		registry: environment.registry,
		uses: environment.uses,
		evaluate(expression) {
			return evaluateExpression(expression, scope);
		},
		callTool(tool, args, span) {
			return invokeTool(tool, args, span, scope, environment);
		},
	};
}

/** Stamp a span and file onto an error that does not carry them yet. */
function anchor(error: SpecError, span: Span, file?: string): SpecError {
	if (error.span === undefined) error.span = span;
	if (error.file === undefined && file !== undefined) error.file = file;
	return error;
}
