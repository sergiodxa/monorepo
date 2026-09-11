/**
 * Tests for the assertion module: expect-form resolution (value, observable,
 * ambiguous), truthiness, structural equality, `contains`, the `not`
 * inversion, and the eventually retry loop with its observable-only rule. The
 * executor is stubbed by a small typed host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type {
	ArgumentNode,
	ArrayNode,
	BlockNode,
	CallNode,
	CommandNode,
	EventuallyNode,
	ExpectNode,
	ExpressionNode,
	LetNode,
	NumberNode,
	ObjectNode,
	ReferenceNode,
	StatementNode,
	StringNode,
	WordNode,
} from "./ast.js";
import type { ExpectationHost } from "./expectation.js";
import type { Plugin } from "./plugin.js";
import type { Registry, ResolvedCallable } from "./registry.js";
import type { Span } from "./source.js";
import type { Value } from "./values.js";

import {
	ExpectationError,
	PermissionDeniedError,
	ResolutionError,
	SpecError,
	ToolError,
} from "./errors.js";
import {
	DEFAULT_EVENTUALLY_MS,
	POLL_INTERVAL_MS,
	executeEventually,
	executeExpect,
} from "./expectation.js";

function span(start = 0, end = 0): Span {
	return { start, end };
}

function str(value: string): StringNode {
	return { kind: "string", value, span: span() };
}

function num(value: number): NumberNode {
	return { kind: "number", value, span: span() };
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

function letStmt(name: string, value: ExpressionNode): LetNode {
	return { kind: "let", name, value, span: span() };
}

function callStmt(target: string, ...args: ArgumentNode[]): CallNode {
	return { kind: "call", target, args, span: span() };
}

function expectStmt(...args: ArgumentNode[]): ExpectNode {
	return { kind: "expect", args, span: span() };
}

function blk(statements: StatementNode[]): BlockNode {
	return { statements, span: span() };
}

function eventuallyStmt(withinMs: number | undefined, statements: StatementNode[]): EventuallyNode {
	let node: EventuallyNode = { kind: "eventually", block: blk(statements), span: span() };
	if (withinMs !== undefined) node.withinMs = withinMs;
	return node;
}

/** A plugin whose `call` must never run: the host stub intercepts dispatch. */
function makeDummyPlugin(namespace: string): Plugin {
	return {
		namespace,
		describe() {
			return [];
		},
		async call() {
			return failure(new ToolError("the dummy plugin must never be called"));
		},
	};
}

interface RegistryTool {
	namespace: string;
	name: string;
	kind: "action" | "observable";
}

function makeRegistry(options: { tools?: RegistryTool[]; commands?: string[] } = {}): Registry {
	let tools = options.tools ?? [];
	let commands = new Map(
		(options.commands ?? []).map((name): [string, CommandNode] => [
			name,
			{ kind: "command", name, params: [], body: blk([]), span: span() },
		]),
	);
	function resolveCallable(
		target: string,
		uses: readonly string[],
	): Result<ResolvedCallable, ResolutionError> {
		let segments = target.split(".");
		if (segments.length === 2) {
			let match = tools.find((tool) => tool.namespace === segments[0] && tool.name === segments[1]);
			if (match) {
				return success({
					kind: "tool",
					plugin: makeDummyPlugin(match.namespace),
					descriptor: { name: match.name, summary: "", kind: match.kind, params: [] },
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
			if (uses.includes(tool.namespace) && tool.name === target) {
				candidates.push({
					kind: "tool",
					plugin: makeDummyPlugin(tool.namespace),
					descriptor: { name: tool.name, summary: "", kind: tool.kind, params: [] },
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

/** A tiny expression evaluator so host stubs stay independent of the executor. */
function evaluateForTest(
	expression: ExpressionNode,
	scope: Map<string, Value>,
): Result<Value, SpecError> {
	if (
		expression.kind === "string" ||
		expression.kind === "number" ||
		expression.kind === "boolean"
	) {
		return success(expression.value);
	}
	if (expression.kind === "duration") return success(expression.milliseconds);
	if (expression.kind === "object") {
		let value: Record<string, Value> = {};
		for (let entry of expression.entries) {
			let entryValue = evaluateForTest(entry.value, scope);
			if (isFailure(entryValue)) return entryValue;
			value[entry.key] = entryValue.data;
		}
		return success(value);
	}
	if (expression.kind === "array") {
		let items: Value[] = [];
		for (let item of expression.items) {
			let itemValue = evaluateForTest(item, scope);
			if (isFailure(itemValue)) return itemValue;
			items.push(itemValue.data);
		}
		return success(items);
	}
	let head = expression.path[0];
	if (head === undefined || !scope.has(head)) {
		return failure(new ResolutionError("unknown-name", `Unknown name "${head ?? ""}"`));
	}
	let current: Value = scope.get(head) ?? null;
	for (let segment of expression.path.slice(1)) {
		if (
			typeof current !== "object" ||
			current === null ||
			Array.isArray(current) ||
			!(segment in current)
		) {
			return failure(new ResolutionError("unknown-name", `Unknown field "${segment}"`));
		}
		current = current[segment] ?? null;
	}
	return success(current);
}

interface HostSetup {
	host: ExpectationHost;
	toolCalls: Array<{ tool: string; args: ArgumentNode[] }>;
	/** Every expression the host was asked to evaluate, in order. */
	evaluations: ExpressionNode[];
}

function makeHost(
	options: {
		bindings?: Record<string, Value>;
		registry?: Registry;
		uses?: readonly string[];
		onTool?: (tool: string, args: ArgumentNode[]) => Result<Value, SpecError>;
		/** Stands in for the executor's evaluator when a test needs a live value. */
		onEvaluate?: (expression: ExpressionNode) => Result<Value, SpecError> | undefined;
	} = {},
): HostSetup {
	let scope = new Map<string, Value>(Object.entries(options.bindings ?? {}));
	let toolCalls: Array<{ tool: string; args: ArgumentNode[] }> = [];
	let evaluations: ExpressionNode[] = [];
	let onTool = options.onTool ?? (() => success(true as Value));
	let host: ExpectationHost = {
		scope,
		registry: options.registry ?? makeRegistry(),
		uses: options.uses ?? [],
		async evaluate(expression) {
			evaluations.push(expression);
			let override = options.onEvaluate?.(expression);
			if (override !== undefined) return override;
			return evaluateForTest(expression, scope);
		},
		async callTool(tool, args) {
			toolCalls.push({ tool: tool.descriptor.name, args });
			return onTool(tool.descriptor.name, args);
		},
	};
	return { host, toolCalls, evaluations };
}

function expectSuccess<T>(result: Result<T, SpecError>): T {
	if (isFailure(result)) throw new Error(`Expected success, got: ${result.error.message}`);
	return result.data;
}

function expectFailure<T>(result: Result<T, SpecError>): SpecError {
	if (isSuccess(result)) throw new Error("Expected a failure result");
	return result.error;
}

describe(executeExpect, () => {
	test("value form compares two values structurally", async () => {
		let { host } = makeHost({ bindings: { a: { x: 1 } } });
		expectSuccess(await executeExpect(expectStmt(ref("a"), obj({ x: num(1) })), host));
	});

	test("a structural mismatch carries expected and observed raw values", async () => {
		let { host } = makeHost({ bindings: { a: { x: 1 } } });
		let error = expectFailure(await executeExpect(expectStmt(ref("a"), obj({ x: num(2) })), host));
		expect(error).toBeInstanceOf(ExpectationError);
		if (!(error instanceof ExpectationError)) throw new Error("narrowing");
		expect(error.expected).toEqual({ x: 2 });
		expect(error.observed).toEqual({ x: 1 });
	});

	test("a single argument asserts truthiness", async () => {
		let { host } = makeHost({ bindings: { ok: true } });
		expectSuccess(await executeExpect(expectStmt(ref("ok")), host));
	});

	test("a falsy single argument fails with the observed value", async () => {
		let { host } = makeHost({ bindings: { empty: "" } });
		let error = expectFailure(await executeExpect(expectStmt(ref("empty")), host));
		expect(error).toBeInstanceOf(ExpectationError);
		if (!(error instanceof ExpectationError)) throw new Error("narrowing");
		expect(error.observed).toBe("");
		expect(error.expected).toBeUndefined();
	});

	test("more than two value-form arguments is a usage error", async () => {
		let { host } = makeHost({ bindings: { a: 1 } });
		let error = expectFailure(await executeExpect(expectStmt(ref("a"), num(1), num(2)), host));
		expect(error.code).toBe("usage-error");
	});

	test("a word second argument reads the binding of that spelling", async () => {
		let { host } = makeHost({ bindings: { a: "x", b: "x" } });
		expectSuccess(await executeExpect(expectStmt(ref("a"), word("b")), host));
	});

	test("a bound word head selects the value form", async () => {
		let { host, toolCalls } = makeHost({ bindings: { ok: true } });
		expectSuccess(await executeExpect(expectStmt(word("ok")), host));
		expect(toolCalls).toHaveLength(0);
	});

	test("an observable word head calls the tool with the remaining arguments", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host, toolCalls } = makeHost({ registry, uses: ["fs"] });
		expectSuccess(await executeExpect(expectStmt(word("file"), str("x"), word("exists")), host));
		expect(toolCalls).toHaveLength(1);
		expect(toolCalls[0]?.tool).toBe("file");
		expect(toolCalls[0]?.args).toHaveLength(2);
	});

	test("an observable tool's failure propagates", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host } = makeHost({
			registry,
			uses: ["fs"],
			onTool: () => failure(new ExpectationError("file missing", "x", null)),
		});
		let error = expectFailure(await executeExpect(expectStmt(word("file"), str("x")), host));
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toBe("file missing");
	});

	test("an observable returning false becomes an expectation failure", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host } = makeHost({ registry, uses: ["fs"], onTool: () => success(false) });
		let error = expectFailure(await executeExpect(expectStmt(word("file"), str("x")), host));
		expect(error).toBeInstanceOf(ExpectationError);
		expect(error.message).toContain("fs.file");
	});

	test("an action tool at the head is not an observable", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "write", kind: "action" }] });
		let { host, toolCalls } = makeHost({ registry, uses: ["fs"] });
		let error = expectFailure(await executeExpect(expectStmt(word("write"), str("x")), host));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("not an observable");
		expect(toolCalls).toHaveLength(0);
	});

	test("a command at the head is not an observable", async () => {
		let registry = makeRegistry({ commands: ["login"] });
		let { host } = makeHost({ registry });
		let error = expectFailure(await executeExpect(expectStmt(word("login"), str("x")), host));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("not an observable");
	});

	test("a head that is both a binding and a callable is ambiguous", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host } = makeHost({ registry, uses: ["fs"], bindings: { file: "x" } });
		let error = expectFailure(await executeExpect(expectStmt(word("file"), str("y")), host));
		expect(error).toBeInstanceOf(ResolutionError);
		if (!(error instanceof ResolutionError)) throw new Error("narrowing");
		expect(error.code).toBe("ambiguous-name");
		expect(error.candidates).toContain("fs.file");
	});

	test("an unknown head is an unknown-name error", async () => {
		let { host } = makeHost();
		let error = expectFailure(await executeExpect(expectStmt(word("nope")), host));
		expect(error.code).toBe("unknown-name");
	});

	test("a dotted head resolves observables through their namespace", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host, toolCalls } = makeHost({ registry });
		expectSuccess(
			await executeExpect(expectStmt(ref("fs", "file"), str("x"), word("exists")), host),
		);
		expect(toolCalls).toHaveLength(1);
	});

	test("a dotted head whose base is bound selects the value form", async () => {
		let { host, toolCalls } = makeHost({ bindings: { user: { email: "e" } } });
		expectSuccess(await executeExpect(expectStmt(ref("user", "email"), str("e")), host));
		expect(toolCalls).toHaveLength(0);
	});
});

describe(executeEventually, () => {
	test("exports the documented timing constants", () => {
		expect(DEFAULT_EVENTUALLY_MS).toBe(5000);
		expect(POLL_INTERVAL_MS).toBe(100);
	});

	test("retries the block until every statement passes", async () => {
		let attempts = 0;
		let registry = makeRegistry({
			tools: [{ namespace: "probe", name: "ready", kind: "observable" }],
		});
		let { host } = makeHost({
			registry,
			uses: ["probe"],
			onTool: () => {
				attempts += 1;
				if (attempts < 3) return failure(new ExpectationError("not ready yet"));
				return success(true);
			},
		});
		let node = eventuallyStmt(3000, [expectStmt(word("ready"))]);
		expectSuccess(await executeEventually(node, host));
		expect(attempts).toBe(3);
	});

	/**
	 * A nested zero-argument call lives in an argument, which the plan keeps as
	 * a node; every attempt evaluates it again, so a block waiting on a composed
	 * value reads the world afresh instead of spinning on its first reading.
	 */
	test("re-evaluates its arguments on every attempt", async () => {
		let readings = [1, 2, 3];
		let { host, evaluations } = makeHost({
			bindings: { wanted: { n: 3 } },
			onEvaluate: (expression) => {
				if (expression.kind !== "object") return undefined;
				return success({ n: readings.shift() ?? 3 });
			},
		});
		let node = eventuallyStmt(3000, [expectStmt(obj({ n: ref("ns", "nonce") }), ref("wanted"))]);
		expectSuccess(await executeEventually(node, host));
		expect(evaluations.filter((expression) => expression.kind === "object")).toHaveLength(3);
	});

	test("reports the last failure when the deadline expires", async () => {
		let attempts = 0;
		let registry = makeRegistry({
			tools: [{ namespace: "probe", name: "ready", kind: "observable" }],
		});
		let { host } = makeHost({
			registry,
			uses: ["probe"],
			onTool: () => {
				attempts += 1;
				return failure(new ExpectationError("still missing"));
			},
		});
		let node = eventuallyStmt(0, [expectStmt(word("ready"))]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.message).toBe("still missing");
		expect(attempts).toBe(1);
	});

	test("rejects let statements before the first attempt", async () => {
		let registry = makeRegistry({
			tools: [{ namespace: "probe", name: "ready", kind: "observable" }],
		});
		let { host, toolCalls } = makeHost({ registry, uses: ["probe"] });
		let node = eventuallyStmt(1000, [letStmt("x", str("1")), expectStmt(word("ready"))]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.code).toBe("usage-error");
		expect(toolCalls).toHaveLength(0);
	});

	test("rejects calls to action tools before the first attempt", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "write", kind: "action" }] });
		let { host, toolCalls } = makeHost({ registry, uses: ["fs"] });
		let node = eventuallyStmt(1000, [callStmt("write", str("f"))]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("not an observable");
		expect(toolCalls).toHaveLength(0);
	});

	test("rejects nested eventually blocks", async () => {
		let { host } = makeHost();
		let node = eventuallyStmt(1000, [eventuallyStmt(undefined, [])]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.code).toBe("usage-error");
	});

	test("an unknown call target fails before the first attempt", async () => {
		let { host } = makeHost();
		let node = eventuallyStmt(1000, [callStmt("nope")]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.code).toBe("unknown-name");
	});

	test("bare observable calls retry on error and pass on success", async () => {
		let attempts = 0;
		let registry = makeRegistry({
			tools: [{ namespace: "fs", name: "file", kind: "observable" }],
		});
		let { host } = makeHost({
			registry,
			uses: ["fs"],
			onTool: () => {
				attempts += 1;
				if (attempts < 2) return failure(new ToolError("flaky read"));
				return success(true);
			},
		});
		let node = eventuallyStmt(3000, [callStmt("file", str("x"), word("exists"))]);
		expectSuccess(await executeEventually(node, host));
		expect(attempts).toBe(2);
	});

	test("a bare observable returning false retries until it holds", async () => {
		let attempts = 0;
		let registry = makeRegistry({
			tools: [{ namespace: "fs", name: "exists", kind: "observable" }],
		});
		let { host } = makeHost({
			registry,
			uses: ["fs"],
			onTool: () => {
				attempts += 1;
				return success(attempts >= 2);
			},
		});
		let node = eventuallyStmt(3000, [callStmt("exists", str("later.txt"))]);
		expectSuccess(await executeEventually(node, host));
		expect(attempts).toBe(2);
	});

	test("a bare observable still false at the deadline is an expectation failure", async () => {
		let attempts = 0;
		let registry = makeRegistry({
			tools: [{ namespace: "fs", name: "exists", kind: "observable" }],
		});
		let { host } = makeHost({
			registry,
			uses: ["fs"],
			onTool: () => {
				attempts += 1;
				return success(false);
			},
		});
		let node = eventuallyStmt(0, [callStmt("exists", str("never.txt"))]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error).toBeInstanceOf(ExpectationError);
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain("fs.exists");
		expect(attempts).toBe(1);
	});

	test("an unknown expect head fails before the first attempt", async () => {
		let { host, toolCalls } = makeHost();
		let started = performance.now();
		let node = eventuallyStmt(3000, [expectStmt(word("nope"))]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.code).toBe("unknown-name");
		expect(toolCalls).toHaveLength(0);
		expect(performance.now() - started).toBeLessThan(1000);
	});

	test("an action tool heading an expect fails before the first attempt", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "write", kind: "action" }] });
		let { host, toolCalls } = makeHost({ registry, uses: ["fs"] });
		let started = performance.now();
		let node = eventuallyStmt(3000, [expectStmt(word("write"), str("f"), str("x"))]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("not an observable");
		expect(toolCalls).toHaveLength(0);
		expect(performance.now() - started).toBeLessThan(1000);
	});
});

/** ADR-018 §3: `contains` is substring for strings and membership for arrays. */
describe("expect A contains B", () => {
	test("a substring of a string holds", async () => {
		let { host } = makeHost({ bindings: { page: "<meta name=og:title>" } });
		expectSuccess(
			await executeExpect(expectStmt(ref("page"), word("contains"), str("og:title")), host),
		);
	});

	test("a missing substring fails carrying both sides", async () => {
		let { host } = makeHost({ bindings: { page: "<html>" } });
		let error = expectFailure(
			await executeExpect(expectStmt(ref("page"), word("contains"), str("og:title")), host),
		);
		expect(error).toBeInstanceOf(ExpectationError);
		if (!(error instanceof ExpectationError)) throw new Error("narrowing");
		expect(error.expected).toBe("og:title");
		expect(error.observed).toBe("<html>");
	});

	test("membership of an array uses structural equality", async () => {
		let { host } = makeHost({ bindings: { rows: [{ id: 1 }, { id: 2 }] } });
		expectSuccess(
			await executeExpect(expectStmt(ref("rows"), word("contains"), obj({ id: num(2) })), host),
		);
	});

	test("an absent member fails", async () => {
		let { host } = makeHost({ bindings: { names: ["a", "b"] } });
		let error = expectFailure(
			await executeExpect(expectStmt(ref("names"), word("contains"), str("c")), host),
		);
		expect(error.code).toBe("expectation-failed");
	});

	test("any other observed type is an error naming the type", async () => {
		let { host } = makeHost({ bindings: { count: 3 } });
		let error = expectFailure(
			await executeExpect(expectStmt(ref("count"), word("contains"), num(3)), host),
		);
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("a number");
	});

	test("looking for a non-string inside a string names the type", async () => {
		let { host } = makeHost({ bindings: { page: "abc" } });
		let error = expectFailure(
			await executeExpect(expectStmt(ref("page"), word("contains"), num(1)), host),
		);
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("a number");
	});

	test("contains takes exactly one value to look for", async () => {
		let { host } = makeHost({ bindings: { page: "abc" } });
		let error = expectFailure(await executeExpect(expectStmt(ref("page"), word("contains")), host));
		expect(error.code).toBe("usage-error");
	});

	test("an array literal is a valid subject", async () => {
		let { host } = makeHost();
		expectSuccess(
			await executeExpect(expectStmt(arr(str("a"), str("b")), word("contains"), str("b")), host),
		);
	});

	test("a tool declaring its own contains word still wins the dispatch", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host, toolCalls } = makeHost({ registry, uses: ["fs"] });
		expectSuccess(
			await executeExpect(expectStmt(word("file"), str("x"), word("contains"), str("y")), host),
		);
		expect(toolCalls).toHaveLength(1);
		expect(toolCalls[0]?.args).toHaveLength(3);
	});
});

/** ADR-018 §3: `not` is expect's alone and inverts whichever form follows. */
describe("expect not", () => {
	test("it inverts truthiness", async () => {
		let { host } = makeHost({ bindings: { empty: "" } });
		expectSuccess(await executeExpect(expectStmt(word("not"), ref("empty")), host));
	});

	test("a truthy value under not fails naming what it wanted", async () => {
		let { host } = makeHost({ bindings: { ok: true } });
		let error = expectFailure(await executeExpect(expectStmt(word("not"), ref("ok")), host));
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain("falsy");
	});

	test("it inverts equality", async () => {
		let { host } = makeHost({ bindings: { a: "x" } });
		expectSuccess(await executeExpect(expectStmt(word("not"), ref("a"), str("y")), host));
		let error = expectFailure(
			await executeExpect(expectStmt(word("not"), ref("a"), str("x")), host),
		);
		expect(error.code).toBe("expectation-failed");
	});

	test("it inverts contains", async () => {
		let { host } = makeHost({ bindings: { page: "<html>" } });
		expectSuccess(
			await executeExpect(
				expectStmt(word("not"), ref("page"), word("contains"), str("og:title")),
				host,
			),
		);
		let error = expectFailure(
			await executeExpect(
				expectStmt(word("not"), ref("page"), word("contains"), str("html")),
				host,
			),
		);
		expect(error.code).toBe("expectation-failed");
	});

	test("an observable that fails passes under not", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host } = makeHost({
			registry,
			uses: ["fs"],
			onTool: () => failure(new ExpectationError("file missing")),
		});
		expectSuccess(
			await executeExpect(expectStmt(word("not"), word("file"), str("x"), word("exists")), host),
		);
	});

	test("an observable returning false passes under not", async () => {
		let registry = makeRegistry({
			tools: [{ namespace: "fs", name: "exists", kind: "observable" }],
		});
		let { host } = makeHost({ registry, uses: ["fs"], onTool: () => success(false) });
		expectSuccess(await executeExpect(expectStmt(word("not"), word("exists"), str("x")), host));
	});

	test("an observable that holds fails under not", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host } = makeHost({ registry, uses: ["fs"], onTool: () => success(true) });
		let error = expectFailure(
			await executeExpect(expectStmt(word("not"), word("file"), str("x")), host),
		);
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain("fs.file");
	});

	test("a denied permission still fails, so a missing grant never reads as absence", async () => {
		let registry = makeRegistry({ tools: [{ namespace: "fs", name: "file", kind: "observable" }] });
		let { host } = makeHost({
			registry,
			uses: ["fs"],
			onTool: () =>
				failure(new PermissionDeniedError("net", "fs.file", "spec run --allow-net", true)),
		});
		let error = expectFailure(
			await executeExpect(expectStmt(word("not"), word("file"), str("x")), host),
		);
		expect(error.code).toBe("permission-denied");
	});

	test("not on its own has nothing to invert", async () => {
		let { host } = makeHost();
		let error = expectFailure(await executeExpect(expectStmt(word("not")), host));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("invert");
	});

	test("not anywhere but first is a usage error", async () => {
		let { host } = makeHost({ bindings: { a: 1 } });
		let error = expectFailure(await executeExpect(expectStmt(ref("a"), word("not")), host));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("first argument to expect");
	});

	test("eventually retries an inverted expect until the thing is absent", async () => {
		let attempts = 0;
		let registry = makeRegistry({
			tools: [{ namespace: "fs", name: "exists", kind: "observable" }],
		});
		let { host } = makeHost({
			registry,
			uses: ["fs"],
			onTool: () => {
				attempts += 1;
				return success(attempts < 3);
			},
		});
		let node = eventuallyStmt(3000, [expectStmt(word("not"), word("exists"), str("gone.txt"))]);
		expectSuccess(await executeEventually(node, host));
		expect(attempts).toBe(3);
	});

	test("an inverted expect that never becomes absent fails at the deadline", async () => {
		let registry = makeRegistry({
			tools: [{ namespace: "fs", name: "exists", kind: "observable" }],
		});
		let { host } = makeHost({ registry, uses: ["fs"], onTool: () => success(true) });
		let node = eventuallyStmt(0, [expectStmt(word("not"), word("exists"), str("stays.txt"))]);
		let error = expectFailure(await executeEventually(node, host));
		expect(error.code).toBe("expectation-failed");
	});
});
