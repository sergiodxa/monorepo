/**
 * Tests for the executor: scope rules, command/fixture invocation, tool
 * dispatch with the central permission gate, and error anchoring. Every
 * dependency is a typed in-memory stub; no real plugin is involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Result } from "@pkg/result";

import { failure, isFailure, isSuccess, success } from "@pkg/result";

import type {
	ArgumentNode,
	BlockNode,
	BooleanNode,
	CallExprNode,
	CallNode,
	CommandNode,
	DurationNode,
	EventuallyNode,
	ExpectNode,
	ExpressionNode,
	FixtureCallNode,
	FixtureNode,
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
} from "./ast";
import type { ExecutionContext } from "./executor";
import type { Grants, PermissionKind, PermissionSet } from "./permissions";
import type { Plugin, ToolDescriptor } from "./plugin";
import type { Registry, ResolvedCallable } from "./registry";
import type { Span } from "./source";
import type { ToolArg, Value } from "./values";
import type { Workspace } from "./workspace";

import { ExpectationError, PermissionDeniedError, ResolutionError, SpecError } from "./errors";
import { executeTest } from "./executor";

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

function fixtureCall(name: string): FixtureCallNode {
	return { kind: "fixture-call", name, span: span() };
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

function fixtureNode(name: string, statements: StatementNode[]): FixtureNode {
	return { kind: "fixture", name, body: blk(statements), span: span() };
}

function descriptor(
	name: string,
	kind: "action" | "observable",
	requires?: PermissionKind,
): ToolDescriptor {
	let base: ToolDescriptor = { name, summary: `the ${name} tool`, kind, params: [] };
	if (requires !== undefined) base.requires = requires;
	return base;
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

function makeRegistry(
	options: { tools?: StubTool[]; commands?: CommandNode[]; fixtures?: FixtureNode[] } = {},
): Registry {
	let tools = options.tools ?? [];
	let commands = new Map((options.commands ?? []).map((command) => [command.name, command]));
	let fixtures = new Map((options.fixtures ?? []).map((fixture) => [fixture.name, fixture]));
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
		resolveFixture(name) {
			let fixture = fixtures.get(name);
			if (fixture) return success(fixture);
			return failure(new ResolutionError("unknown-name", `Unknown fixture "${name}"`));
		},
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
		...overrides,
	};
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
	return {
		registry: makeRegistry(),
		workspace: makeWorkspace(),
		permissions: makePermissions(),
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
		expect(error.message).toContain("command and fixture bodies");
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
				{ namespace: "fs", descriptor: descriptor("check", "observable"), plugin: recorded.plugin },
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

	test("fixture calls yield the fixture's returned value", async () => {
		let registry = makeRegistry({
			fixtures: [fixtureNode("user", [retStmt(obj({ name: str("n") }))])],
		});
		let node = makeTest({
			given: [letStmt("u", fixtureCall("user"))],
			verify: [expectStmt(ref("u", "name"), str("n"))],
		});
		expectSuccess(await executeTest(node, makeContext({ registry })));
	});

	test("a fixture that never returns yields null", async () => {
		let registry = makeRegistry({ fixtures: [fixtureNode("empty", [])] });
		let node = makeTest({
			given: [letStmt("v", fixtureCall("empty"))],
			verify: [expectStmt(ref("v"))],
		});
		let error = expectFailure(await executeTest(node, makeContext({ registry })));
		expect(error).toBeInstanceOf(ExpectationError);
		if (!(error instanceof ExpectationError)) throw new Error("narrowing");
		expect(error.observed).toBeNull();
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
		// The span is an offset into the defining file's text; stamping the
		// calling test's path would map it onto the wrong source.
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
				{ namespace: "fs", descriptor: descriptor("file", "observable"), plugin: recorded.plugin },
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

	// A bare-path `let`/`return` right-hand side normally reads a binding, but
	// when its head is not bound it may name a zero-argument tool — the change
	// that lets `let current = browser.url` capture the current URL as a value.
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

		test("a zero-arg tool value is capturable from a return inside a fixture", async () => {
			let recorded = makePlugin("ns", () => success("from-fixture"));
			let registry = makeRegistry({
				tools: [
					{
						namespace: "ns",
						descriptor: descriptor("thing", "observable"),
						plugin: recorded.plugin,
					},
				],
				fixtures: [fixtureNode("landing", [retStmt(ref("ns", "thing"))])],
			});
			let node = makeTest({
				given: [letStmt("v", fixtureCall("landing"))],
				verify: [expectStmt(ref("v"), str("from-fixture"))],
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
			// `thing` is both a binding and an imported tool name; the binding wins
			// because a reference requires a bound head, so the two never collide.
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
