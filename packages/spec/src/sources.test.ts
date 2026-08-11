/**
 * Tests for loading a suite from in-memory sources: the registration pass the
 * on-disk loader delegates to, exercised without touching a filesystem — which
 * is the whole reason it is a separate entry point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure } from "@pkg/result";

import { loadSources } from "./sources";

describe("loadSources", () => {
	test("parses every source and keeps them in the given order", () => {
		let passing = (title: string) => `test "${title}" {\n\tthen {\n\t\texpect true\n\t}\n}`;
		let result = loadSources([
			{ path: "second.spec", text: passing("b") },
			{ path: "first.spec", text: passing("a") },
		]);
		if (isFailure(result)) throw new Error(result.error.message);
		expect(result.data.files.map((file) => file.path)).toEqual(["second.spec", "first.spec"]);
		expect(result.data.files.flatMap((file) => file.tests.map((node) => node.title))).toEqual([
			"b",
			"a",
		]);
	});

	test("registers commands and fixtures suite-globally across sources", () => {
		let result = loadSources([
			{ path: "commands.spec", text: "command seed() {\n\tlet x = { a: 1 }\n}" },
			{ path: "fixtures.spec", text: 'fixture book {\n\treturn { title: "Dune" }\n}' },
		]);
		if (isFailure(result)) throw new Error(result.error.message);
		expect([...result.data.commands.keys()]).toEqual(["seed"]);
		expect([...result.data.fixtures.keys()]).toEqual(["book"]);
	});

	test("a duplicate definition across sources is a load error naming both", () => {
		let result = loadSources([
			{ path: "a.spec", text: "command seed() {\n\tlet x = { a: 1 }\n}" },
			{ path: "b.spec", text: "fixture seed {\n\treturn 1\n}" },
		]);
		if (!isFailure(result)) throw new Error("Expected a duplicate-definition failure.");
		expect(result.error.code).toBe("duplicate-definition");
		expect(result.error.message).toContain("a.spec");
		expect(result.error.message).toContain("b.spec");
	});

	test("a parse error is prefixed with the source's path", () => {
		let result = loadSources([{ path: "broken.spec", text: 'test "unclosed" {' }]);
		if (!isFailure(result)) throw new Error("Expected a parse failure.");
		expect(result.error.code).toBe("parse-error");
		expect(result.error.message).toStartWith("broken.spec:");
		expect(result.error.file).toBe("broken.spec");
	});

	test("an empty source list is a load error rather than an empty suite", () => {
		let result = loadSources([]);
		if (!isFailure(result)) throw new Error("Expected a load failure.");
		expect(result.error.code).toBe("load-error");
	});
});
