/**
 * Tests for the built-in `url` plugin: pure query/fragment/path/host parsing
 * over an absolute URL string. Every tool is permissionless and observable, so
 * these tests need no permission set beyond the stub and never touch the
 * network or filesystem.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Result } from "@pkg/result";

import { isFailure, success, unwrap } from "@pkg/result";

import type { SpecError } from "../errors";
import type { PermissionSet } from "../permissions";
import type { ToolContext } from "../plugin";
import type { ToolArg, Value } from "../values";
import type { Workspace } from "../workspace";

import { createUrlPlugin } from "./url";

const PLUGIN = createUrlPlugin();

/** Wrap a runtime value as a positional value argument. */
function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** Wrap a bare identifier as a word argument. */
function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** A permission set that grants nothing; the url plugin never asks it anything. */
function grantNothing(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

/** A workspace stub; url tools never touch the filesystem. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-url-tests",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

/** Build a tool context; the url plugin ignores everything but its arguments. */
function buildContext(): ToolContext {
	return { workspace: stubWorkspace(), permissions: grantNothing() };
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

describe(createUrlPlugin.name, () => {
	test("describes four permissionless observable tools", () => {
		expect(PLUGIN.namespace).toBe("url");
		let tools = PLUGIN.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["query", "fragment", "path", "host"]);
		for (let tool of tools) {
			expect(tool.kind).toBe("observable");
			expect(tool.requires).toBeUndefined();
		}
		let query = tools.find((tool) => tool.name === "query");
		expect(query?.params.map((param) => [param.name, param.kind, param.required])).toEqual([
			["url", "value", true],
			["name", "value", true],
		]);
		let path = tools.find((tool) => tool.name === "path");
		expect(path?.params.map((param) => [param.name, param.kind, param.required])).toEqual([
			["url", "value", true],
		]);
	});

	test("query returns the value of a present query-string parameter", async () => {
		let result = await PLUGIN.call(
			"query",
			[value("http://localhost:3002/healthcheck?code=abc123&state=xyz"), value("code")],
			buildContext(),
		);
		expect(unwrap(result)).toBe("abc123");
	});

	test("query decodes percent-encoded parameter values", async () => {
		let result = await PLUGIN.call(
			"query",
			[value("https://app.test/cb?redirect=%2Fhome%3Fx%3D1"), value("redirect")],
			buildContext(),
		);
		expect(unwrap(result)).toBe("/home?x=1");
	});

	test("query on a missing parameter is a tool error naming the parameter and url", async () => {
		let error = unwrapError(
			await PLUGIN.call(
				"query",
				[value("http://localhost:3002/cb?state=xyz"), value("code")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("code");
		expect(error.message).toContain("http://localhost:3002/cb?state=xyz");
	});

	test("fragment returns the value of a parameter after the hash", async () => {
		let result = await PLUGIN.call(
			"fragment",
			[
				value("http://localhost:3002/cb#access_token=tok123&token_type=bearer"),
				value("access_token"),
			],
			buildContext(),
		);
		expect(unwrap(result)).toBe("tok123");
	});

	test("fragment on a missing parameter is a tool error", async () => {
		let error = unwrapError(
			await PLUGIN.call(
				"fragment",
				[value("http://localhost:3002/cb#state=xyz"), value("code")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("code");
	});

	test("path returns the URL pathname", async () => {
		let result = await PLUGIN.call(
			"path",
			[value("http://localhost:3002/oauth/token?x=1")],
			buildContext(),
		);
		expect(unwrap(result)).toBe("/oauth/token");
	});

	test("host returns the URL host including the port", async () => {
		let result = await PLUGIN.call("host", [value("http://localhost:3002/x")], buildContext());
		expect(unwrap(result)).toBe("localhost:3002");
	});

	test("an unparseable URL is a tool error", async () => {
		let error = unwrapError(
			await PLUGIN.call("query", [value("not a url"), value("code")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("not a url");
	});

	test("a non-string url argument is a tool error", async () => {
		let error = unwrapError(await PLUGIN.call("query", [value(42), value("code")], buildContext()));
		expect(error.code).toBe("tool-error");
	});

	test("a non-string name argument is a tool error", async () => {
		let error = unwrapError(
			await PLUGIN.call("query", [value("http://a.test/?code=1"), value(7)], buildContext()),
		);
		expect(error.code).toBe("tool-error");
	});

	test("a bare word in argument position is a tool error, not a lookup", async () => {
		let error = unwrapError(
			await PLUGIN.call("query", [value("http://a.test/?code=1"), word("code")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
	});

	test("query rejects a missing name argument", async () => {
		let error = unwrapError(
			await PLUGIN.call("query", [value("http://a.test/?code=1")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let error = unwrapError(
			await PLUGIN.call("segment", [value("http://a.test/")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("query, fragment, path, host");
	});
});
