/**
 * Tests for the executor: scope rules, command invocation, descriptor-driven
 * argument resolution, tool dispatch with the central permission gate, and
 * error anchoring. Every dependency is a typed in-memory stub; no real plugin
 * is involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { describe, expect, test } from "vitest";

import type {
	ArgumentNode,
	ArrayNode,
	BlockNode,
	BooleanNode,
	CallExprNode,
	CallNode,
	CommandNode,
	DurationNode,
	EventuallyNode,
	ExpectNode,
	ExpressionNode,
	HookNode,
	LetNode,
	NumberNode,
	ObjectNode,
	ReferenceNode,
	ReturnNode,
	RhsNode,
	StatementNode,
	StringNode,
	TestNode,
	WordNode,
} from "./ast.js";
import type { ExecutionContext } from "./executor.js";
import type { Grants, PermissionKind, PermissionSet } from "./permissions.js";
import type { Plugin, ToolDescriptor, ToolParam } from "./plugin.js";
import type { Registry, ResolvedCallable } from "./registry.js";
import type { Span } from "./source.js";
import type { ToolArg, Value } from "./values.js";
import type { Workspace } from "./workspace.js";

import { ExpectationError, PermissionDeniedError, ResolutionError, SpecError } from "./errors.js";
import { executeHook, executeTest } from "./executor.js";

/** Build a span; tests that assert spans pass distinctive offsets. */
function span(start = 0, end = 0): Span {
	return { start, end };
}

function str(value: string): StringNode {
	return { kind: "string", value, span: span() };
}

function num(value: number): NumberNode {
	return { kind: "number", value, span: span() };
}

function bool(value: boolean): BooleanNode {
	return { kind: "boolean", value, span: span() };
}

function dur(milliseconds: number): DurationNode {
	return { kind: "duration", milliseconds, span: span() };
}

function obj(entries: Record<string, ExpressionNode>): ObjectNode {
	return {
		kind: "object",
		entries: Object.entries(entries).map(([key, value]) => ({ key, value, span: span() })),
		span: span(),
	};
}

function ref(...path: string[]): ReferenceNode {
	return { kind: "reference", path, span: span() };
}

function arr(...items: ExpressionNode[]): ArrayNode {
	return { kind: "array", items, span: span() };
}

function word(value: string): WordNode {
	return { kind: "word", word: value, span: span() };
}

function letStmt(name: string, value: RhsNode): LetNode {
	return { kind: "let", name, value, span: span() };
}

function retStmt(value: RhsNode): ReturnNode {
	return { kind: "return", value, span: span() };
}

function callStmt(target: string, ...args: ArgumentNode[]): CallNode {
	return { kind: "call", target, args, span: span() };
}

function callExpr(target: string, ...args: ArgumentNode[]): CallExprNode {
	return { kind: "call-expr", target, args, span: span() };
}

function expectStmt(...args: ArgumentNode[]): ExpectNode {
	return { kind: "expect", args, span: span() };
}

function eventuallyStmt(withinMs: number | undefined, statements: StatementNode[]): EventuallyNode {
	let node: EventuallyNode = { kind: "eventually", block: blk(statements), span: span() };
	if (withinMs !== undefined) node.withinMs = withinMs;
	return node;
}

function blk(statements: StatementNode[]): BlockNode {
	return { statements, span: span() };
}

/** Build a TestNode; `verify` fills the grammar's `then` phase. */
function makeTest(phases: {
	given?: StatementNode[];
	when?: StatementNode[];
	verify?: StatementNode[];
}): TestNode {
	let node: TestNode = { title: "a test", span: span() };
	if (phases.given) node.given = blk(phases.given);
	if (phases.when) node.when = blk(phases.when);
	// oxlint-disable-next-line unicorn/no-thenable -- the grammar names the phase "then"; a TestNode is never awaited.
	if (phases.verify) node.then = blk(phases.verify);
	return node;
}

function commandNode(name: string, params: string[], statements: StatementNode[]): CommandNode {
	return { kind: "command", name, params, body: blk(statements), span: span() };
}

function hookNode(kind: HookNode["kind"], statements: StatementNode[]): HookNode {
	return { kind, body: blk(statements), span: span() };
}

function descriptor(
	name: string,
	kind: "action" | "observable",
	requires?: PermissionKind,
	params: ToolParam[] = [],
): ToolDescriptor {
	let base: ToolDescriptor = { name, summary: `the ${name} tool`, kind, params };
	if (requires !== undefined) base.requires = requires;
	return base;
}

/** A declared parameter, spelled the way a plugin descriptor spells one. */
function param(name: string, kind: "value" | "word", required = true): ToolParam {
	return { name, kind, required, summary: `the ${name} parameter` };
}

interface StubTool {
	namespace: string;
	descriptor: ToolDescriptor;
	plugin: Plugin;
}

interface RecordedPlugin {
	plugin: Plugin;
	calls: Array<{ tool: string; args: ToolArg[] }>;
}

function makePlugin(
	namespace: string,
	handler: (tool: string, args: ToolArg[]) => Result<Value, SpecError>,
): RecordedPlugin {
	let calls: Array<{ tool: string; args: ToolArg[] }> = [];
	let plugin: Plugin = {
		namespace,
		describe() {
			return [];
		},
		async call(tool, args) {
			calls.push({ tool, args });
			return handler(tool, args);
		},
	};
	return { plugin, calls };
}

function makeRegistry(options: { tools?: StubTool[]; commands?: CommandNode[] } = {}): Registry {
	let tools = options.tools ?? [];
	let commands = new Map((options.commands ?? []).map((command) => [command.name, command]));
	function resolveCallable(
		target: string,
		uses: readonly string[],
	): Result<ResolvedCallable, ResolutionError> {
		let segments = target.split(".");
		if (segments.length === 2) {
			let match = tools.find(
				(tool) => tool.namespace === segments[0] && tool.descriptor.name === segments[1],
			);
			if (match) {
				return success({
					kind: "tool",
					plugin: match.plugin,
					descriptor: match.descriptor,
					namespace: match.namespace,
				});
			}
			return failure(new ResolutionError("unknown-name", `Unknown tool "${target}"`));
		}
		if (segments.length > 2) {
			return failure(new ResolutionError("unknown-name", `Unknown name "${target}"`));
		}
		let candidates: ResolvedCallable[] = [];
		let command = commands.get(target);
		if (command) candidates.push({ kind: "command", command });
		for (let tool of tools) {
			if (uses.includes(tool.namespace) && tool.descriptor.name === target) {
				candidates.push({
					kind: "tool",
					plugin: tool.plugin,
					descriptor: tool.descriptor,
					namespace: tool.namespace,
				});
			}
		}
		let first = candidates[0];
		if (candidates.length === 1 && first) return success(first);
		if (candidates.length === 0) {
			return failure(new ResolutionError("unknown-name", `Unknown name "${target}"`));
		}
		return failure(new ResolutionError("ambiguous-name", `"${target}" is ambiguous`));
	}
	return {
		resolveCallable,
		isCallable(target, uses) {
			return isSuccess(resolveCallable(target, uses));
		},
	};
}

function makeWorkspace(): Workspace {
	return {
		root: "/tmp/spec-test-workspace",
		resolve(path) {
			return success(path);
		},
		async cleanup() {
			return undefined;
		},
	};
}

function makePermissions(): PermissionSet {
	return {
		checkRun() {
			return success(undefined);
		},
		checkNet() {
			return success(undefined);
		},
		checkEnv() {
			return success(undefined);
		},
		checkHostFs() {
			return success(undefined);
		},
		checkDb() {
			return success(undefined);
		},
		grantedEnvNames() {
			return [];
		},
	};
}

function makeGrants(overrides: Partial<Grants> = {}): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
		db: { mode: "denied" },
		...overrides,
	};
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
	return {
		registry: makeRegistry(),
		workspace: makeWorkspace(),
		permissions: makePermissions(),
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
		uses: [],
		usesFor: () => [],
		grants: makeGrants(),
		...overrides,
	};
}

function expectSuccess<T>(result: Result<T, SpecError>): T {
	if (isFailure(result)) throw new Error(`Expected success, got: ${result.error.message}`);
	return result.data;
}

function expectFailure<T>(result: Result<T, SpecError>): SpecError {
	if (isSuccess(result)) throw new Error("Expected a failure result");
	return result.error;
}

describe(executeTest, () => {
	test("given, when and then share one scope", async () => {
		let node = makeTest({
			given: [letStmt("a", str("hello"))],
			when: [letStmt("b", ref("a"))],
			verify: [expectStmt(ref("b"), str("hello"))],
		});
		expectSuccess(await executeTest(node, makeContext()));
	});

	test("rebinding a name is a usage error with the statement's span", async () => {
		let second = letStmt("a", str("y"));
		second.span = { start: 40, end: 52 };
		let node = makeTest({ given: [letStmt("a", str("x")), second] });
		let error = expectFailure(await executeTest(node, makeContext()));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("already bound");
		expect(error.span).toEqual({ start: 40, end: 52 });
	});

	test("return at test level is a usage error", async () => {
		let node = makeTest({ when: [retStmt(str("x"))] });
		let error = expectFailure(await executeTest(node, makeContext()));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("inside a command body");
	});

	test("an unbound reference is an unknown-name error with the reference's span", async () => {
		let reference = ref("missing");
		reference.span = { start: 7, end: 14 };
		let node = makeTest({ when: [letStmt("a", reference)] });
		let error = expectFailure(await executeTest(node, makeContext()));
		expect(error).toBeInstanceOf(ResolutionError);
		expect(error.code).toBe("unknown-name");
		expect(error.span).toEqual({ start: 7, end: 14 });
	});

	test("a missing field is an unknown-name error naming the field", async () => {
		let node = makeTest({
			given: [letStmt("user", obj({ name: str("n") }))],
			when: [letStmt("email", ref("user", "email"))],
		});
		let error = expectFailure(await executeTest(node, makeContext()));
		expect(error.code).toBe("unknown-name");
		expect(error.message).toContain('"email"');
	});

	test("durations, booleans, and objects with references evaluate", async () => {
		let node = makeTest({
			given: [
				letStmt("t", dur(1500)),
				letStmt("flag", bool(true)),
				letStmt("user", obj({ email: str("e@example.com") })),
				letStmt("payload", obj({ timeout: ref("t"), user: ref("user") })),
			],
			verify: [
				expectStmt(ref("flag")),
				expectStmt(ref("payload", "timeout"), num(1500)),
				expectStmt(ref("payload", "user", "email"), str("e@example.com")),
				expectStmt(
					ref("payload"),
					obj({ timeout: num(1500), user: obj({ email: str("e@example.com") }) }),
				),
			],
		});
		expectSuccess(await executeTest(node, makeContext()));
	});

	test("tool calls receive evaluated values and untouched words", async () => {
		let recorded = makePlugin("fs", () => success(true));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "fs",
					descriptor: descriptor("check", "observable", undefined, [
						param("path", "value"),
						param("assertion", "word"),
					]),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({ when: [callStmt("check", str("a.txt"), word("exists"))] });
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["fs"] })));
		expect(recorded.calls).toEqual([
			{
				tool: "check",
				args: [
					{ kind: "value", value: "a.txt" },
					{ kind: "word", word: "exists" },
				],
			},
		]);
	});

	test("a call expression binds the tool's value for later references", async () => {
		let recorded = makePlugin("cli", () => success({ stdout: "ok", exit_code: 0 }));
		let registry = makeRegistry({
			tools: [
				{ namespace: "cli", descriptor: descriptor("run", "action"), plugin: recorded.plugin },
			],
		});
		let node = makeTest({
			when: [letStmt("r", callExpr("run", str("node")))],
			verify: [expectStmt(ref("r", "exit_code"), num(0))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["cli"] })));
	});

	test("commands bind parameters positionally and produce their return value", async () => {
		let registry = makeRegistry({
			commands: [commandNode("echo", ["value"], [retStmt(ref("value"))])],
		});
		let node = makeTest({
			when: [letStmt("r", callExpr("echo", str("hi")))],
			verify: [expectStmt(ref("r"), str("hi"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
	});

	test("command arity mismatches are usage errors", async () => {
		let registry = makeRegistry({
			commands: [commandNode("echo", ["value"], [retStmt(ref("value"))])],
		});
		let node = makeTest({ when: [letStmt("r", callExpr("echo"))] });
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("expects 1");
	});

	test("word arguments to commands resolve the caller's bindings", async () => {
		let registry = makeRegistry({
			commands: [commandNode("echo", ["value"], [retStmt(ref("value"))])],
		});
		let node = makeTest({
			given: [letStmt("u", obj({ name: str("n") }))],
			when: [letStmt("r", callExpr("echo", word("u")))],
			verify: [expectStmt(ref("r", "name"), str("n"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
	});

	test("command bodies never see the caller's scope", async () => {
		let registry = makeRegistry({
			commands: [commandNode("leak", [], [retStmt(ref("secret"))])],
		});
		let node = makeTest({
			given: [letStmt("secret", str("s"))],
			when: [letStmt("r", callExpr("leak"))],
		});
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error.code).toBe("unknown-name");
	});

	test("return ends a command body before later statements", async () => {
		let recorded = makePlugin("fs", () => success(true));
		let registry = makeRegistry({
			tools: [
				{ namespace: "fs", descriptor: descriptor("check", "observable"), plugin: recorded.plugin },
			],
			commands: [commandNode("early", [], [retStmt(str("a")), callStmt("check")])],
		});
		let node = makeTest({
			when: [letStmt("r", callExpr("early"))],
			verify: [expectStmt(ref("r"), str("a"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["fs"] })));
		expect(recorded.calls).toHaveLength(0);
	});

	test("a zero-parameter command on a bare-path rhs yields its returned value", async () => {
		let registry = makeRegistry({
			commands: [commandNode("user", [], [retStmt(obj({ name: str("n") }))])],
		});
		let node = makeTest({
			given: [letStmt("u", ref("user"))],
			verify: [expectStmt(ref("u", "name"), str("n"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
	});

	test("a command that never returns yields null", async () => {
		let registry = makeRegistry({ commands: [commandNode("empty", [], [])] });
		let node = makeTest({
			given: [letStmt("v", ref("empty"))],
			verify: [expectStmt(ref("v"))],
		});
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error).toBeInstanceOf(ExpectationError);
		if (!(error instanceof ExpectationError)) throw new Error("narrowing");
		expect(error.observed).toBeNull();
	});

	test("a command with parameters on a bare-path rhs is an arity error", async () => {
		let registry = makeRegistry({
			commands: [commandNode("greet", ["name"], [retStmt(ref("name"))])],
		});
		let node = makeTest({ given: [letStmt("v", ref("greet"))] });
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("expects 1");
	});

	test("recursive commands hit the call depth cap", async () => {
		let registry = makeRegistry({ commands: [commandNode("loop", [], [callStmt("loop")])] });
		let node = makeTest({ when: [callStmt("loop")] });
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("32");
		expect(error.message).toContain("cycle");
	});

	test("the gate blocks a denied permission family before the plugin runs", async () => {
		let recorded = makePlugin("http", () => success(null));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "http",
					descriptor: descriptor("get", "action", "net"),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({ when: [callStmt("http.get", str("https://example.com"))] });
		let error = expectFailure(
			await executeTest(node, makeContext({ registry, grants: makeGrants() })),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		if (!(error instanceof PermissionDeniedError)) throw new Error("narrowing");
		expect(error.permission).toBe("net");
		expect(error.resource).toBe("http.get");
		expect(error.remedy).toBe("spec run --allow-net");
		expect(recorded.calls).toHaveLength(0);
	});

	test("the gate lets non-denied grants through to the plugin's scoped checks", async () => {
		let recorded = makePlugin("http", () => success(null));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "http",
					descriptor: descriptor("get", "action", "net"),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({ when: [callStmt("http.get", str("https://example.com"))] });
		let grants = makeGrants({ net: { mode: "scoped", scopes: ["example.com"] } });
		expectSuccess(await executeTest(node, makeContext({ registry, grants })));
		expect(recorded.calls).toHaveLength(1);
	});

	test("the gate ignores tools that require no permission, even with everything denied", async () => {
		let recorded = makePlugin("demo", () => success(null));
		let registry = makeRegistry({
			tools: [
				{ namespace: "demo", descriptor: descriptor("say", "action"), plugin: recorded.plugin },
			],
		});
		let node = makeTest({ when: [callStmt("demo.say", str("hi"))] });
		expectSuccess(await executeTest(node, makeContext({ registry, grants: makeGrants() })));
		expect(recorded.calls).toHaveLength(1);
	});

	test("a command body resolves bare names against its defining file's imports", async () => {
		let recorded = makePlugin("fs", () => success(null));
		let setup = commandNode("setup", [], [callStmt("write", str("a.txt"), str("hi"))]);
		let registry = makeRegistry({
			tools: [
				{ namespace: "fs", descriptor: descriptor("write", "action"), plugin: recorded.plugin },
			],
			commands: [setup],
		});
		let node = makeTest({ when: [callStmt("setup")] });
		let context = makeContext({
			registry,
			uses: [],
			usesFor: (definition) => (definition === setup ? ["fs"] : []),
		});
		expectSuccess(await executeTest(node, context));
		expect(recorded.calls).toEqual([
			{
				tool: "write",
				args: [
					{ kind: "value", value: "a.txt" },
					{ kind: "value", value: "hi" },
				],
			},
		]);
	});

	test("the caller's imports never leak into a command body", async () => {
		let recorded = makePlugin("fs", () => success(null));
		let setup = commandNode("setup", [], [callStmt("write", str("a.txt"), str("hi"))]);
		let registry = makeRegistry({
			tools: [
				{ namespace: "fs", descriptor: descriptor("write", "action"), plugin: recorded.plugin },
			],
			commands: [setup],
		});
		let node = makeTest({ when: [callStmt("setup")] });
		let error = expectFailure(
			await executeTest(node, makeContext({ registry, uses: ["fs"], usesFor: () => [] })),
		);
		expect(error.code).toBe("unknown-name");
		expect(recorded.calls).toHaveLength(0);
	});

	test("errors carry the test's file path when the context provides one", async () => {
		let node = makeTest({ given: [letStmt("a", str("x")), letStmt("a", str("y"))] });
		let error = expectFailure(await executeTest(node, makeContext({ file: "spec/a.spec" })));
		expect(error.file).toBe("spec/a.spec");
	});

	test("errors in a command body anchor to the defining file, not the caller's", async () => {
		let missing = ref("missing_binding");
		missing.span = { start: 60, end: 75 };
		let broken = commandNode("broken", [], [letStmt("x", missing)]);
		let registry = makeRegistry({ commands: [broken] });
		let node = makeTest({ when: [callStmt("broken")] });
		let error = expectFailure(
			await executeTest(
				node,
				makeContext({
					registry,
					file: "spec/main.spec",
					fileFor: (definition) =>
						definition === broken ? "spec/commands/helper.spec" : undefined,
				}),
			),
		);
		expect(error.code).toBe("unknown-name");
		/**
		 * The span is an offset into the defining file's text, so it must pair
		 * with that file's path rather than the calling test's.
		 */
		expect(error.file).toBe("spec/commands/helper.spec");
		expect(error.span).toEqual({ start: 60, end: 75 });
	});

	test("an unknown call target propagates the resolution error with its span", async () => {
		let statement = callStmt("nope");
		statement.span = { start: 3, end: 7 };
		let node = makeTest({ when: [statement] });
		let error = expectFailure(await executeTest(node, makeContext()));
		expect(error.code).toBe("unknown-name");
		expect(error.span).toEqual({ start: 3, end: 7 });
	});

	test("observable expects flow through the executor's tool dispatch", async () => {
		let recorded = makePlugin("fs", () => success(true));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "fs",
					descriptor: descriptor("file", "observable", undefined, [
						param("path", "value"),
						param("assertion", "word"),
					]),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({ verify: [expectStmt(word("file"), str("x"), word("exists"))] });
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["fs"] })));
		expect(recorded.calls).toEqual([
			{
				tool: "file",
				args: [
					{ kind: "value", value: "x" },
					{ kind: "word", word: "exists" },
				],
			},
		]);
	});

	test("eventually retries an expect until the observable flips", async () => {
		let attempts = 0;
		let recorded = makePlugin("probe", () => {
			attempts += 1;
			if (attempts < 3) return failure(new ExpectationError("not ready yet"));
			return success(true);
		});
		let registry = makeRegistry({
			tools: [
				{
					namespace: "probe",
					descriptor: descriptor("ready", "observable"),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({
			verify: [eventuallyStmt(3000, [expectStmt(word("ready"))])],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["probe"] })));
		expect(attempts).toBe(3);
	});

	/**
	 * An unbound bare-path head may name a zero-argument tool, the mechanism
	 * that lets `let current = browser.url` capture the current URL as a
	 * value.
	 */
	describe("a bare-path RHS that names a zero-arg tool", () => {
		test("a qualified zero-arg tool is invoked and its value captured", async () => {
			let recorded = makePlugin("ns", () => success("captured-value"));
			let registry = makeRegistry({
				tools: [
					{
						namespace: "ns",
						descriptor: descriptor("thing", "observable"),
						plugin: recorded.plugin,
					},
				],
			});
			let node = makeTest({
				when: [letStmt("x", ref("ns", "thing"))],
				verify: [expectStmt(ref("x"), str("captured-value"))],
			});
			expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
			expect(recorded.calls).toEqual([{ tool: "thing", args: [] }]);
		});

		test("a bare zero-arg tool imported with `use` is invoked and captured", async () => {
			let recorded = makePlugin("ns", () => success(42));
			let registry = makeRegistry({
				tools: [
					{ namespace: "ns", descriptor: descriptor("now", "observable"), plugin: recorded.plugin },
				],
			});
			let node = makeTest({
				when: [letStmt("t", ref("now"))],
				verify: [expectStmt(ref("t"), num(42))],
			});
			expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
			expect(recorded.calls).toEqual([{ tool: "now", args: [] }]);
		});

		test("a zero-arg tool value is capturable from a return inside a command", async () => {
			let recorded = makePlugin("ns", () => success("from-command"));
			let registry = makeRegistry({
				tools: [
					{
						namespace: "ns",
						descriptor: descriptor("thing", "observable"),
						plugin: recorded.plugin,
					},
				],
				commands: [commandNode("landing", [], [retStmt(ref("ns", "thing"))])],
			});
			let node = makeTest({
				given: [letStmt("v", ref("landing"))],
				verify: [expectStmt(ref("v"), str("from-command"))],
			});
			expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
			expect(recorded.calls).toEqual([{ tool: "thing", args: [] }]);
		});

		test("a bound head is always a reference; the same-named tool is never called", async () => {
			let recorded = makePlugin("ns", () => success("tool-value"));
			let registry = makeRegistry({
				tools: [
					{
						namespace: "ns",
						descriptor: descriptor("thing", "observable"),
						plugin: recorded.plugin,
					},
				],
			});
			/**
			 * `thing` is both a binding and an imported tool name; a reference
			 * always requires a bound head, so the binding wins and the two
			 * never collide.
			 */
			let node = makeTest({
				given: [letStmt("thing", str("bound-value"))],
				when: [letStmt("y", ref("thing"))],
				verify: [expectStmt(ref("y"), str("bound-value"))],
			});
			expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
			expect(recorded.calls).toHaveLength(0);
		});

		test("a tool with a required argument is not auto-invoked; the path is unknown", async () => {
			let recorded = makePlugin("ns", () => success("x"));
			let needsArg: ToolDescriptor = {
				name: "needs",
				summary: "needs an argument",
				kind: "observable",
				params: [{ name: "a", kind: "value", required: true, summary: "a required argument" }],
			};
			let registry = makeRegistry({
				tools: [{ namespace: "ns", descriptor: needsArg, plugin: recorded.plugin }],
			});
			let node = makeTest({ when: [letStmt("x", ref("ns", "needs"))] });
			let error = expectFailure(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
			expect(error.code).toBe("unknown-name");
			expect(recorded.calls).toHaveLength(0);
		});

		test("capturing a zero-arg tool still passes through the permission gate", async () => {
			let recorded = makePlugin("browser", () => success("http://localhost/cb"));
			let registry = makeRegistry({
				tools: [
					{
						namespace: "browser",
						descriptor: descriptor("url", "observable", "net"),
						plugin: recorded.plugin,
					},
				],
			});
			let node = makeTest({ when: [letStmt("current", ref("browser", "url"))] });
			let error = expectFailure(
				await executeTest(node, makeContext({ registry, uses: ["browser"], grants: makeGrants() })),
			);
			expect(error).toBeInstanceOf(PermissionDeniedError);
			if (!(error instanceof PermissionDeniedError)) throw new Error("narrowing");
			expect(error.permission).toBe("net");
			expect(error.resource).toBe("browser.url");
			expect(recorded.calls).toHaveLength(0);
		});
	});
});
/**
 * ADR-018 §5: the rule that admits `browser.url` on a right-hand side holds
 * wherever an expression may appear, so a composed value —
 * `format "${name}-${nonce}" { name: who.username, nonce: spec.nonce }` —
 * reads the tool inline instead of binding it on a line of its own first.
 */
describe("a zero-argument call nested in an expression", () => {
	/** An `ns.nonce` tool handing out the given values in order, one per call. */
	function nonceTool(values: Value[]): { registry: Registry; calls: RecordedPlugin["calls"] } {
		let next = 0;
		let recorded = makePlugin("ns", () => {
			let value = values[Math.min(next, values.length - 1)] ?? null;
			next++;
			return success(value);
		});
		let registry = makeRegistry({
			tools: [
				{ namespace: "ns", descriptor: descriptor("nonce", "observable"), plugin: recorded.plugin },
			],
			commands: [commandNode("wrap", ["v"], [retStmt(ref("v"))])],
		});
		return { registry, calls: recorded.calls };
	}

	test("an object entry invokes the tool and holds its value", async () => {
		let { registry, calls } = nonceTool(["r1-1"]);
		let node = makeTest({
			when: [letStmt("payload", obj({ name: str("marta"), nonce: ref("ns", "nonce") }))],
			verify: [expectStmt(ref("payload", "nonce"), str("r1-1"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
		expect(calls).toEqual([{ tool: "nonce", args: [] }]);
	});

	test("an array item invokes the tool and holds its value", async () => {
		let { registry } = nonceTool(["r1-1"]);
		let node = makeTest({
			when: [letStmt("parts", arr(str("user"), ref("ns", "nonce")))],
			verify: [expectStmt(ref("parts", "1"), str("r1-1"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
	});

	test("nesting composes, so a path inside an object inside an array resolves", async () => {
		let { registry } = nonceTool(["r1-1"]);
		let node = makeTest({
			when: [letStmt("rows", arr(obj({ nonce: ref("ns", "nonce") })))],
			verify: [expectStmt(ref("rows", "0", "nonce"), str("r1-1"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
	});

	test("a dotted path in tool-argument position is the tool's observed value", async () => {
		let recorded = makePlugin("ns", (tool) => success(tool === "nonce" ? "r1-1" : true));
		let registry = makeRegistry({
			tools: [
				{ namespace: "ns", descriptor: descriptor("nonce", "observable"), plugin: recorded.plugin },
				{
					namespace: "ns",
					descriptor: descriptor("act", "action", undefined, [param("value", "value")]),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({ when: [callStmt("ns.act", ref("ns", "nonce"))] });
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
		expect(recorded.calls).toEqual([
			{ tool: "nonce", args: [] },
			{ tool: "act", args: [{ kind: "value", value: "r1-1" }] },
		]);
	});

	test("a command argument is the nested call's value, bound to the parameter", async () => {
		let { registry, calls } = nonceTool(["r1-1"]);
		let node = makeTest({
			when: [letStmt("v", callExpr("wrap", ref("ns", "nonce")))],
			verify: [expectStmt(ref("v"), str("r1-1"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
		expect(calls).toEqual([{ tool: "nonce", args: [] }]);
	});

	test("a bound head inside an object stays a reference and never calls the tool", async () => {
		let { registry, calls } = nonceTool(["tool-value"]);
		let node = makeTest({
			given: [letStmt("nonce", str("bound-value"))],
			when: [letStmt("payload", obj({ nonce: ref("nonce") }))],
			verify: [expectStmt(ref("payload", "nonce"), str("bound-value"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
		expect(calls).toHaveLength(0);
	});

	test("a nested path that resolves to nothing is still the unknown-name error", async () => {
		let { registry } = nonceTool(["r1-1"]);
		let node = makeTest({ when: [letStmt("payload", obj({ nonce: ref("ns", "missing") }))] });
		let error = expectFailure(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
		expect(error.code).toBe("unknown-name");
	});

	test("a nested tool that requires an argument is not auto-invoked", async () => {
		let recorded = makePlugin("ns", () => success("x"));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "ns",
					descriptor: descriptor("needs", "observable", undefined, [param("a", "value")]),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({ when: [letStmt("payload", obj({ a: ref("ns", "needs") }))] });
		let error = expectFailure(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
		expect(error.code).toBe("unknown-name");
		expect(recorded.calls).toHaveLength(0);
	});

	test("a nested call runs through the permission gate, so a denied family refuses", async () => {
		let recorded = makePlugin("browser", () => success("http://localhost/cb"));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "browser",
					descriptor: descriptor("url", "observable", "net"),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({ when: [letStmt("payload", obj({ at: ref("browser", "url") }))] });
		let error = expectFailure(
			await executeTest(node, makeContext({ registry, uses: ["browser"], grants: makeGrants() })),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		if (!(error instanceof PermissionDeniedError)) throw new Error("narrowing");
		expect(error.permission).toBe("net");
		expect(error.resource).toBe("browser.url");
		expect(recorded.calls).toHaveLength(0);
	});

	/**
	 * `eventually` resolves each statement's form once, so a nested call has to
	 * be invoked by the attempt rather than captured by the plan; otherwise a
	 * block waiting on a composed value would spin on its first reading.
	 */
	test("every eventually attempt re-invokes the nested call", async () => {
		let { registry, calls } = nonceTool([1, 2, 3]);
		let node = makeTest({
			verify: [
				eventuallyStmt(3000, [expectStmt(obj({ n: ref("ns", "nonce") }), obj({ n: num(3) }))]),
			],
		});
		expectSuccess(await executeTest(node, makeContext({ registry, uses: ["ns"] })));
		expect(calls).toHaveLength(3);
	});
});

/**
 * ADR-018 §2: a bare identifier handed to a tool means whatever the tool's
 * descriptor says it means, so a binding reaches a tool without the wrapper
 * object the language previously demanded.
 */
describe("bare identifiers in tool-argument position", () => {
	/** A tool that records what it received, with the given declared parameters. */
	function toolTest(params: ToolParam[]): { registry: Registry; calls: RecordedPlugin["calls"] } {
		let recorded = makePlugin("ns", () => success(true));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "ns",
					descriptor: descriptor("act", "action", undefined, params),
					plugin: recorded.plugin,
				},
			],
		});
		return { registry, calls: recorded.calls };
	}

	test("a spelling the tool declares as a word stays a word", async () => {
		let { registry, calls } = toolTest([param("path", "value"), param("recursive", "word", false)]);
		let node = makeTest({ when: [callStmt("ns.act", str("dir"), word("recursive"))] });
		expectSuccess(await executeTest(node, makeContext({ registry })));
		expect(calls[0]?.args[1]).toEqual({ kind: "word", word: "recursive" });
	});

	test("a word-kind parameter at this position makes any spelling a word", async () => {
		let { registry, calls } = toolTest([param("path", "value"), param("assertion", "word")]);
		let node = makeTest({ when: [callStmt("ns.act", str("note.txt"), word("exists"))] });
		expectSuccess(await executeTest(node, makeContext({ registry })));
		expect(calls[0]?.args[1]).toEqual({ kind: "word", word: "exists" });
	});

	test("an undeclared spelling reads the binding of that name", async () => {
		let { registry, calls } = toolTest([param("target", "value")]);
		let node = makeTest({
			given: [letStmt("profile", str("/sergio"))],
			when: [callStmt("ns.act", word("profile"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
		expect(calls[0]?.args).toEqual([{ kind: "value", value: "/sergio" }]);
	});

	test("a binding of any shape reaches the tool whole", async () => {
		let { registry, calls } = toolTest([param("target", "value")]);
		let node = makeTest({
			given: [letStmt("user", obj({ email: str("e@example.com") }))],
			when: [callStmt("ns.act", word("user"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
		expect(calls[0]?.args).toEqual([{ kind: "value", value: { email: "e@example.com" } }]);
	});

	test("a declared word that is also bound is ambiguous, naming both readings", async () => {
		let { registry, calls } = toolTest([param("path", "value"), param("recursive", "word", false)]);
		let node = makeTest({
			given: [letStmt("recursive", bool(true))],
			when: [callStmt("ns.act", str("dir"), word("recursive"))],
		});
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error).toBeInstanceOf(ResolutionError);
		expect(error.code).toBe("ambiguous-name");
		expect(error.message).toContain("recursive");
		expect(calls).toHaveLength(0);
	});

	test("a word-kind parameter at this position wins over a binding, unambiguously", async () => {
		let { registry, calls } = toolTest([param("path", "value"), param("assertion", "word")]);
		let node = makeTest({
			given: [letStmt("exists", str("bound")), letStmt("p", str("note.txt"))],
			when: [callStmt("ns.act", word("p"), word("exists"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
		expect(calls[0]?.args).toEqual([
			{ kind: "value", value: "note.txt" },
			{ kind: "word", word: "exists" },
		]);
	});

	test("a spelling that is neither declared nor bound is an unknown name", async () => {
		let { registry, calls } = toolTest([param("target", "value")]);
		let node = makeTest({ when: [callStmt("ns.act", word("nowhere"))] });
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error.code).toBe("unknown-name");
		expect(error.message).toContain("nowhere");
		expect(calls).toHaveLength(0);
	});

	test("a stray not in tool-argument position names where not belongs", async () => {
		let { registry } = toolTest([param("target", "value")]);
		let node = makeTest({ when: [callStmt("ns.act", word("not"))] });
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("first argument to expect");
	});
});

describe("array literals and numeric path segments", () => {
	test("an array literal evaluates item by item, nesting included", async () => {
		let node = makeTest({
			given: [letStmt("id", num(7)), letStmt("params", arr(ref("id"), str("x"), arr(bool(true))))],
			verify: [expectStmt(ref("params"), arr(num(7), str("x"), arr(bool(true))))],
		});
		expectSuccess(await executeTest(node, makeContext()));
	});

	test("an array literal is a valid tool argument", async () => {
		let recorded = makePlugin("db", () => success(null));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "db",
					descriptor: descriptor("query", "action", undefined, [
						param("sql", "value"),
						param("params", "word", false),
					]),
					plugin: recorded.plugin,
				},
			],
		});
		let node = makeTest({
			given: [letStmt("id", num(3))],
			when: [callStmt("db.query", str("select 1"), word("params"), arr(ref("id"), num(9)))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
		expect(recorded.calls[0]?.args[2]).toEqual({ kind: "value", value: [3, 9] });
	});

	test("a digit segment indexes an array 0-based", async () => {
		let node = makeTest({
			given: [letStmt("result", obj({ rows: arr(obj({ id: num(1) }), obj({ id: num(2) })) }))],
			verify: [expectStmt(ref("result", "rows", "0", "id"), num(1))],
		});
		expectSuccess(await executeTest(node, makeContext()));
	});

	test("an out-of-range index is an unknown name naming what was there", async () => {
		let node = makeTest({
			given: [letStmt("result", obj({ rows: arr(obj({ id: num(1) })) }))],
			when: [letStmt("missing", ref("result", "rows", "3"))],
		});
		let error = expectFailure(await executeTest(node, makeContext()));
		expect(error.code).toBe("unknown-name");
		expect(error.message).toContain("1 item");
	});

	test("a digit segment against a non-array names the type it found", async () => {
		let node = makeTest({
			given: [letStmt("result", obj({ rows: str("not a list") }))],
			when: [letStmt("missing", ref("result", "rows", "0"))],
		});
		let error = expectFailure(await executeTest(node, makeContext()));
		expect(error.code).toBe("unknown-name");
		expect(error.message).toContain("a string");
	});
});

describe(executeHook, () => {
	test("a hook body runs let, calls, and expect in its own scope", async () => {
		let recorded = makePlugin("fs", () => success(null));
		let registry = makeRegistry({
			tools: [
				{
					namespace: "fs",
					descriptor: descriptor("write", "action", undefined, [
						param("path", "value"),
						param("content", "value"),
					]),
					plugin: recorded.plugin,
				},
			],
		});
		let hook = hookNode("setup", [
			letStmt("path", str("seed.json")),
			callStmt("write", word("path"), str("{}")),
			expectStmt(ref("path"), str("seed.json")),
		]);
		expectSuccess(await executeHook(hook, makeContext({ registry, uses: ["fs"] })));
		expect(recorded.calls[0]?.args).toEqual([
			{ kind: "value", value: "seed.json" },
			{ kind: "value", value: "{}" },
		]);
	});

	test("a failing statement ends the hook and carries its span", async () => {
		let reference = ref("missing");
		reference.span = { start: 11, end: 18 };
		let hook = hookNode("teardown", [letStmt("v", reference)]);
		let error = expectFailure(await executeHook(hook, makeContext({ file: "spec/a.spec" })));
		expect(error.code).toBe("unknown-name");
		expect(error.span).toEqual({ start: 11, end: 18 });
		expect(error.file).toBe("spec/a.spec");
	});

	test("return is a usage error inside a hook", async () => {
		let hook = hookNode("setup", [retStmt(str("x"))]);
		let error = expectFailure(await executeHook(hook, makeContext()));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("inside a command body");
	});
});
