/**
 * The interpreter core of the runtime: executes one test's statements against
 * the suite registry, an isolated workspace, and the caller's grants. Owns
 * scopes, `let`/`return`, command invocation, and the central permission gate
 * that refuses denied permission families before a plugin ever sees the call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Random } from "@sdxc/sample";

import { failure, isFailure, success } from "@sdxc/result";

import type { ArtifactStore } from "./artifacts.js";
import type {
	ArgumentNode,
	CommandNode,
	DefinitionNode,
	ExpressionNode,
	HookNode,
	ReferenceNode,
	RhsNode,
	StatementNode,
	TestNode,
} from "./ast.js";
import type { BaseSet, ConnectionSet } from "./bases.js";
import type { ExpectationHost } from "./expectation.js";
import type { Grants, PermissionKind, PermissionSet } from "./permissions.js";
import type { RunIdentity, ToolDescriptor } from "./plugin.js";
import type { Registry, ResolvedCallable } from "./registry.js";
import type { Span } from "./source.js";
import type { ToolArg, Value, ValueObject } from "./values.js";
import type { Workspace } from "./workspace.js";

import { PermissionDeniedError, ResolutionError, SpecError, ToolError } from "./errors.js";
import { executeEventually, executeExpect, strayNotError } from "./expectation.js";
import { createToolContext } from "./tool-context.js";

/** How deep command invocations may nest before a cycle is suspected. */
const MAX_CALL_DEPTH = 32;

/** Maps a permission family to its key in the {@link Grants} record. */
const GRANT_KEYS = {
	run: "run",
	net: "net",
	env: "env",
	"host-fs": "hostFs",
	db: "db",
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
	/** The test's seeded stream, handed to every tool call that generates data. */
	random: Random;
	/** The instant the test started, frozen for the whole test. */
	now: Date;
	/** Namespaces imported by the test's file, in `use` order. */
	uses: readonly string[];
	/**
	 * The namespaces imported by the file that DEFINED a command — `use` is
	 * file-scoped, so a definition's body resolves bare names against its own
	 * file's imports, never the caller's.
	 */
	usesFor: (definition: DefinitionNode) => readonly string[];
	/**
	 * The path of the file that DEFINED a command. Errors inside a definition's
	 * body anchor to the defining file so their spans map onto the source text
	 * they came from; when absent, errors keep the calling file.
	 */
	fileFor?: (definition: DefinitionNode) => string | undefined;
	/**
	 * The parsed grant modes: the executor refuses a denied permission family
	 * before its plugin runs, and scoped refinement (host, binary) happens
	 * inside the plugin through the runtime-owned `PermissionSet`.
	 */
	grants: Grants;
	/** Path of the file the test lives in, stamped onto every error. */
	file?: string;
	/** What this run and this attempt are called; specs read it as `spec.*`. */
	run?: RunIdentity;
	/** The run's named bases, which every relative target resolves through. */
	bases?: BaseSet;
	/** The run's named database connections, which `on "…"` selects among. */
	connections?: ConnectionSet;
	/** Where a failing tool writes what a person needs to see the failure. */
	artifacts?: ArtifactStore;
}

/** The per-test execution services plus the current call depth. */
interface Environment extends ExecutionContext {
	/** Current command nesting depth, for the recursion cap. */
	depth: number;
}

/** How a statement sequence ended: ran to completion, or hit a `return`. */
type BlockOutcome = { kind: "completed" } | { kind: "returned"; value: Value };

/**
 * Execute one test: its `given`, `when`, and `then` phases share a single
 * scope and run in order, and the first failing statement ends the test.
 * Every error is stamped with the failing statement's span and file path.
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
 * Execute one suite hook body — `setup` or `teardown` — in a scope of its own.
 * A hook arranges and observes rather than producing a value, so `let`, calls,
 * `expect` and `eventually` run here while `return` is a usage error.
 *
 * @param hook - The hook whose body to run.
 * @param context - The suite services and grants the hook runs against.
 * @returns Success when every statement held, otherwise the first failure.
 */
export async function executeHook(
	hook: HookNode,
	context: ExecutionContext,
): Promise<Result<undefined, SpecError>> {
	let environment: Environment = { ...context, depth: 0 };
	let outcome = await executeStatements(hook.body.statements, new Map(), environment, false);
	if (isFailure(outcome)) return outcome;
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
			return failure(new SpecError("usage-error", "return is only valid inside a command body"));
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

/** Evaluate a `let`/`return` right-hand side: an expression or a call. */
async function evaluateRhs(
	rhs: RhsNode,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	if (rhs.kind === "call-expr") {
		return invokeCallable(rhs.target, rhs.args, rhs.span, scope, environment);
	}
	return evaluateExpression(rhs, scope, environment);
}

/**
 * A bare path normally references the scope; an unbound head may instead name
 * an argument-less tool or a zero-parameter command, dispatched through the
 * ordinary call path so the runtime's permission gate still applies.
 */
function zeroArgumentCall(
	reference: ReferenceNode,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> | undefined {
	let head = reference.path[0];
	if (head === undefined || scope.has(head)) return undefined;
	let resolved = environment.registry.resolveCallable(reference.path.join("."), environment.uses);
	if (isFailure(resolved)) return undefined;
	if (resolved.data.kind === "command") {
		/**
		 * A command that declares parameters is still dispatched, so the caller
		 * reads an arity error naming the command rather than an unknown name.
		 */
		return invokeCommand(resolved.data.command, [], reference.span, scope, environment);
	}
	if (resolved.data.descriptor.params.some((param) => param.required)) return undefined;
	return invokeTool(resolved.data, [], reference.span, scope, environment);
}

/**
 * Evaluate one expression in the scope. The rule is uniform wherever an
 * expression may appear, so a composed value reads an argument-less tool
 * inline — `{ nonce: spec.nonce }` — instead of binding it on a line first.
 */
async function evaluateExpression(
	expression: ExpressionNode,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	if (expression.kind === "string") return success(expression.value);
	if (expression.kind === "number") return success(expression.value);
	if (expression.kind === "boolean") return success(expression.value);
	if (expression.kind === "duration") return success(expression.milliseconds);
	if (expression.kind === "object") {
		let object: ValueObject = {};
		for (let entry of expression.entries) {
			let value = await evaluateExpression(entry.value, scope, environment);
			if (isFailure(value)) return value;
			object[entry.key] = value.data;
		}
		return success(object);
	}
	if (expression.kind === "array") {
		let items: Value[] = [];
		for (let item of expression.items) {
			let value = await evaluateExpression(item, scope, environment);
			if (isFailure(value)) return value;
			items.push(value.data);
		}
		return success(items);
	}
	let call = zeroArgumentCall(expression, scope, environment);
	if (call !== undefined) return call;
	return resolveReference(expression, scope);
}

/**
 * Resolve a dotted reference: the head segment must be a binding, an
 * all-digits segment indexes an array 0-based, and every other segment is a
 * field of the value so far — a miss is an `unknown-name` error, never `null`.
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
		let prefix = reference.path.slice(0, index).join(".");
		if (/^\d+$/.test(segment)) {
			if (!Array.isArray(current)) {
				return failure(
					anchor(
						new ResolutionError(
							"unknown-name",
							`Unknown index ${segment} — "${prefix}" holds ${describeValue(current)}, not an array`,
						),
						reference.span,
					),
				);
			}
			let position = Number(segment);
			if (position >= current.length) {
				return failure(
					anchor(
						new ResolutionError(
							"unknown-name",
							`Unknown index ${segment} — "${prefix}" holds ${current.length} item(s)`,
						),
						reference.span,
					),
				);
			}
			current = current[position] ?? null;
			continue;
		}
		if (
			typeof current !== "object" ||
			current === null ||
			Array.isArray(current) ||
			!(segment in current)
		) {
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

/** Name a value's shape for a diagnostic, the way a reader would name it. */
function describeValue(value: Value): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "an array";
	if (typeof value === "object") return "an object";
	return `a ${typeof value}`;
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
 * Invoke one plugin tool: resolve each argument against the tool's declared
 * parameters, pass the central permission gate, then hand the call to the
 * plugin with the test's workspace and grants.
 */
async function invokeTool(
	tool: Extract<ResolvedCallable, { kind: "tool" }>,
	args: ArgumentNode[],
	span: Span,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	let toolArgs: ToolArg[] = [];
	for (let index = 0; index < args.length; index++) {
		let argument = args[index];
		if (argument === undefined) continue;
		let resolved = await resolveToolArgument(argument, index, tool.descriptor, scope, environment);
		if (isFailure(resolved)) return resolved;
		toolArgs.push(resolved.data);
	}
	let gate = gateToolCall(tool, environment);
	if (isFailure(gate)) return failure(anchor(gate.error, span, environment.file));
	let result = await tool.plugin.call(
		tool.descriptor.name,
		toolArgs,
		createToolContext(toolContextOverrides(environment)),
	);
	if (isFailure(result)) return failure(anchor(result.error, span, environment.file));
	return result;
}

/** The parts of a {@link ToolContext} this run actually configured. */
function toolContextOverrides(environment: Environment): Parameters<typeof createToolContext>[0] {
	let overrides: Parameters<typeof createToolContext>[0] = {
		workspace: environment.workspace,
		permissions: environment.permissions,
		random: environment.random,
		now: environment.now,
	};
	if (environment.run) overrides.run = environment.run;
	if (environment.bases) overrides.bases = environment.bases;
	if (environment.connections) overrides.connections = environment.connections;
	if (environment.artifacts) overrides.artifacts = environment.artifacts;
	return overrides;
}

/**
 * Decide what a bare identifier in tool-argument position means, which the
 * tool's own declaration answers: a spelling it declares as a word (by name,
 * or by the parameter sitting at this position) is a symbol, and anything
 * else reads the binding of that spelling.
 */
async function resolveToolArgument(
	argument: ArgumentNode,
	index: number,
	descriptor: ToolDescriptor,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<ToolArg, SpecError>> {
	if (argument.kind !== "word") {
		let value = await evaluateExpression(argument, scope, environment);
		if (isFailure(value)) return value;
		return success({ kind: "value", value: value.data });
	}
	let named = descriptor.params.some(
		(param) => param.kind === "word" && param.name === argument.word,
	);
	let bound = scope.has(argument.word);
	if (named && bound) {
		return failure(
			anchor(
				new ResolutionError(
					"ambiguous-name",
					`"${argument.word}" is both a word "${descriptor.name}" declares and a binding in scope; the runtime never guesses — rename the binding or pass it as a dotted reference`,
					[`the word ${argument.word}`, `the binding ${argument.word}`],
				),
				argument.span,
			),
		);
	}
	/**
	 * A required parameter settles the reading by position, so it never
	 * collides. Optional parameters cannot: a tool whose options are
	 * word-tagged (`params <value> on "web" one`) accepts them in any order
	 * after the required ones, which leaves position saying nothing about what
	 * an argument this far along was meant to be.
	 */
	let positional = descriptor.params[index];
	if (named || (positional?.kind === "word" && positional.required)) {
		return success({ kind: "word", word: argument.word });
	}
	if (bound) return success({ kind: "value", value: scope.get(argument.word) ?? null });
	if (argument.word === "not") return failure(strayNotError(argument.span));
	return failure(
		anchor(
			new ResolutionError(
				"unknown-name",
				`Unknown name "${argument.word}" — "${descriptor.name}" declares no such word, and nothing is bound under it`,
			),
			argument.span,
		),
	);
}

/**
 * The runtime's coarse permission gate: a tool whose required permission
 * family is denied outright never reaches its plugin; scoped refinement
 * happens inside the plugin through the runtime-owned `PermissionSet`.
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
 * reads the caller's binding of that spelling) and bound positionally to a
 * fresh scope; the body's `return` value (or `null`) is the call's value.
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
		let value = await evaluateValueArgument(argument, scope, environment);
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

/**
 * Run a command body under the recursion cap; a body that never returns
 * produces `null`. Because `use` is file-scoped, the body resolves bare names
 * against the defining file's imports, so its errors anchor there.
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
					`Call depth exceeded ${MAX_CALL_DEPTH} while invoking ${definition.kind} "${definition.name}" — a command cycle is suspected`,
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
async function evaluateValueArgument(
	argument: ArgumentNode,
	scope: Map<string, Value>,
	environment: Environment,
): Promise<Result<Value, SpecError>> {
	if (argument.kind !== "word") return evaluateExpression(argument, scope, environment);
	if (!scope.has(argument.word)) {
		if (argument.word === "not") return failure(strayNotError(argument.span));
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
			return evaluateExpression(expression, scope, environment);
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
