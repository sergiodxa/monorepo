/**
 * Tests for name resolution: dotted targets stay inside their namespace, bare
 * targets gather candidates from suite commands and `use`-imported
 * namespaces, and any ambiguity is an error listing every candidate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, success } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { BlockNode, CommandNode, FixtureNode } from "./ast";
import type { Plugin } from "./plugin";
import type { Span } from "./source";
import type { LoadedSuite } from "./sources";

import { ResolutionError } from "./errors";
import { createRegistry } from "./registry";

const SPAN: Span = { start: 0, end: 0 };

function makeBlock(): BlockNode {
	return { statements: [], span: SPAN };
}

function makeCommand(name: string): CommandNode {
	return { kind: "command", name, params: [], body: makeBlock(), span: SPAN };
}

function makeFixture(name: string): FixtureNode {
	return { kind: "fixture", name, body: makeBlock(), span: SPAN };
}

function makeSuite(definitions: Array<CommandNode | FixtureNode> = []): LoadedSuite {
	let commands = new Map<string, CommandNode>();
	let fixtures = new Map<string, FixtureNode>();
	for (let definition of definitions) {
		if (definition.kind === "command") commands.set(definition.name, definition);
		else fixtures.set(definition.name, definition);
	}
	return { files: [], commands, fixtures };
}

function makePlugin(namespace: string, toolNames: string[]): Plugin {
	return {
		namespace,
		describe() {
			return toolNames.map((name) => ({
				name,
				summary: `The ${name} tool.`,
				kind: "action" as const,
				params: [],
			}));
		},
		async call() {
			return success(null);
		},
	};
}

describe("createRegistry", () => {
	describe("resolveCallable with a dotted target", () => {
		test("resolves ns.tool inside the namespace without any use import", () => {
			let fs = makePlugin("fs", ["write", "read"]);
			let registry = createRegistry([fs], makeSuite());

			let result = registry.resolveCallable("fs.write", []);

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) throw new Error("expected a success");
			expect(result.data.kind).toBe("tool");
			if (result.data.kind !== "tool") throw new Error("expected a tool");
			expect(result.data.plugin).toBe(fs);
			expect(result.data.namespace).toBe("fs");
			expect(result.data.descriptor.name).toBe("write");
		});

		test("fails with unknown-name when no plugin provides the namespace", () => {
			let registry = createRegistry([makePlugin("fs", ["write"])], makeSuite());

			let result = registry.resolveCallable("http.post", []);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error).toBeInstanceOf(ResolutionError);
			expect(result.error.code).toBe("unknown-name");
			expect(result.error.message).toContain('"http"');
		});

		test("fails with unknown-name listing the namespace's tools when the tool is missing", () => {
			let registry = createRegistry([makePlugin("fs", ["write", "read"])], makeSuite());

			let result = registry.resolveCallable("fs.remove", []);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error.code).toBe("unknown-name");
			expect(result.error.message).toContain("fs.write");
			expect(result.error.message).toContain("fs.read");
		});

		test("fails with unknown-name on a target with two or more dots", () => {
			let registry = createRegistry([makePlugin("fs", ["write"])], makeSuite());

			let result = registry.resolveCallable("fs.deep.write", []);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error.code).toBe("unknown-name");
			expect(result.error.message).toContain("fs.deep.write");
		});
	});

	describe("resolveCallable with a bare target", () => {
		test("resolves a suite command without any use import", () => {
			let login = makeCommand("login");
			let registry = createRegistry([], makeSuite([login]));

			let result = registry.resolveCallable("login", []);

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) throw new Error("expected a success");
			expect(result.data.kind).toBe("command");
			if (result.data.kind !== "command") throw new Error("expected a command");
			expect(result.data.command).toBe(login);
		});

		test("resolves a tool of a namespace the file imported", () => {
			let fs = makePlugin("fs", ["write"]);
			let registry = createRegistry([fs], makeSuite());

			let result = registry.resolveCallable("write", ["fs"]);

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) throw new Error("expected a success");
			expect(result.data.kind).toBe("tool");
			if (result.data.kind !== "tool") throw new Error("expected a tool");
			expect(result.data.namespace).toBe("fs");
			expect(result.data.descriptor.name).toBe("write");
		});

		test("does not resolve a tool of a namespace the file did not import", () => {
			let registry = createRegistry([makePlugin("fs", ["write"])], makeSuite());

			let result = registry.resolveCallable("write", []);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error.code).toBe("unknown-name");
		});

		test("fails with unknown-name when nothing matches", () => {
			let registry = createRegistry([makePlugin("fs", ["write"])], makeSuite());

			let result = registry.resolveCallable("deploy", ["fs"]);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error.code).toBe("unknown-name");
			expect(result.error.message).toContain('"deploy"');
		});

		test("fails with ambiguous-name when two imported namespaces expose the name", () => {
			let fs = makePlugin("fs", ["write"]);
			let disk = makePlugin("disk", ["write"]);
			let registry = createRegistry([fs, disk], makeSuite());

			let result = registry.resolveCallable("write", ["fs", "disk"]);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error).toBeInstanceOf(ResolutionError);
			expect(result.error.code).toBe("ambiguous-name");
			expect(result.error.candidates).toEqual(["fs.write", "disk.write"]);
			expect(result.error.message).toContain("fs.write");
			expect(result.error.message).toContain("disk.write");
		});

		test("fails with ambiguous-name when a command and an imported tool share the name", () => {
			let write = makeCommand("write");
			let fs = makePlugin("fs", ["write"]);
			let registry = createRegistry([fs], makeSuite([write]));

			let result = registry.resolveCallable("write", ["fs"]);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error.code).toBe("ambiguous-name");
			expect(result.error.candidates).toEqual(["write", "fs.write"]);
		});

		test("qualified resolution still works when the bare name is ambiguous", () => {
			let write = makeCommand("write");
			let fs = makePlugin("fs", ["write"]);
			let registry = createRegistry([fs], makeSuite([write]));

			let result = registry.resolveCallable("fs.write", ["fs"]);

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) throw new Error("expected a success");
			expect(result.data.kind).toBe("tool");
		});

		test("importing the same namespace twice creates no false ambiguity", () => {
			let fs = makePlugin("fs", ["write"]);
			let registry = createRegistry([fs], makeSuite());

			let result = registry.resolveCallable("write", ["fs", "fs"]);

			expect(isSuccess(result)).toBe(true);
		});

		test("a use of a namespace no plugin provides contributes no candidates", () => {
			let fs = makePlugin("fs", ["write"]);
			let registry = createRegistry([fs], makeSuite());

			let result = registry.resolveCallable("write", ["ghost", "fs"]);

			expect(isSuccess(result)).toBe(true);
		});
	});

	describe("resolveFixture", () => {
		test("resolves a suite fixture by name", () => {
			let admin = makeFixture("admin");
			let registry = createRegistry([], makeSuite([admin]));

			let result = registry.resolveFixture("admin");

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) throw new Error("expected a success");
			expect(result.data).toBe(admin);
		});

		test("fails with unknown-name when the fixture does not exist", () => {
			let registry = createRegistry([], makeSuite());

			let result = registry.resolveFixture("admin");

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) throw new Error("expected a failure");
			expect(result.error).toBeInstanceOf(ResolutionError);
			expect(result.error.code).toBe("unknown-name");
			expect(result.error.message).toContain('"admin"');
		});
	});

	describe("isCallable", () => {
		test("mirrors resolveCallable success", () => {
			let fs = makePlugin("fs", ["write"]);
			let registry = createRegistry([fs], makeSuite([makeCommand("login")]));

			expect(registry.isCallable("login", [])).toBe(true);
			expect(registry.isCallable("fs.write", [])).toBe(true);
			expect(registry.isCallable("write", ["fs"])).toBe(true);
		});

		test("mirrors resolveCallable failure", () => {
			let fs = makePlugin("fs", ["write"]);
			let disk = makePlugin("disk", ["write"]);
			let registry = createRegistry([fs, disk], makeSuite());

			expect(registry.isCallable("write", [])).toBe(false);
			expect(registry.isCallable("write", ["fs", "disk"])).toBe(false);
			expect(registry.isCallable("fs.remove", [])).toBe(false);
			expect(registry.isCallable("a.b.c", [])).toBe(false);
		});
	});
});
