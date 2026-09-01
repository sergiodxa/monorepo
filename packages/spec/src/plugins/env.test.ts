/**
 * Tests for the built-in `env` plugin: the descriptors, the per-name
 * permission check, the fallback, and the failure a spec gets when it names a
 * variable nobody set. Each test owns the variables it touches and restores
 * `process.env` afterwards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";
import { createRandom } from "@pkg/sample";
import { afterEach, describe, expect, test } from "vitest";

import type { SpecError } from "../errors";
import type { PermissionSet } from "../permissions";
import type { ToolContext } from "../plugin";
import type { ToolArg, Value } from "../values";
import type { Workspace } from "../workspace";

import { PermissionDeniedError } from "../errors";

import { createEnvPlugin } from "./env";

/** The variable name every test reads; removed again in `afterEach`. */
const NAME = "SPEC_ENV_PLUGIN_TEST";

function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** A workspace stub satisfying the tool context's shape; these tests exercise permission checks only. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-env-unit",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

/** A permission set granting only the named variables. */
function grantEnv(...granted: string[]): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [...granted],
		checkEnv: (name) => {
			if (granted.includes(name)) return success(undefined);
			return failure(new PermissionDeniedError("env", name, `spec run --allow-env=${name}`));
		},
	};
}

function buildContext(permissions: PermissionSet): ToolContext {
	return {
		workspace: stubWorkspace(),
		permissions,
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
	};
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

/** Narrow to the success data or fail the test with the error's message. */
function expectSuccess(result: Result<Value, SpecError>): Value {
	if (isFailure(result)) throw new Error(`Expected success, got: ${result.error.message}`);
	return result.data;
}

describe(createEnvPlugin.name, () => {
	let plugin = createEnvPlugin();

	afterEach(() => {
		delete process.env[NAME];
	});

	test("describes one tool, requiring env, with an optional fallback", () => {
		expect(plugin.namespace).toBe("env");
		let tools = plugin.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["get"]);
		expect(tools[0]?.kind).toBe("observable");
		expect(tools[0]?.requires).toBe("env");
		expect(tools[0]?.params.map((param) => [param.name, param.required])).toEqual([
			["name", true],
			["fallback", false],
		]);
	});

	test("reads a granted variable that is set", async () => {
		process.env[NAME] = "from-the-environment";
		let result = await plugin.call("get", [value(NAME)], buildContext(grantEnv(NAME)));
		expect(expectSuccess(result)).toBe("from-the-environment");
	});

	test("an ungranted variable is denied and names the scoped flag", async () => {
		process.env[NAME] = "unreachable";
		let error = unwrapError(
			await plugin.call("get", [value(NAME)], buildContext(grantEnv("OTHER_VAR"))),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.code).toBe("permission-denied");
		expect(error.remedy).toContain(`--allow-env=${NAME}`);
	});

	test("a fallback covers an unset variable but never a missing grant", async () => {
		expect(
			expectSuccess(
				await plugin.call("get", [value(NAME), value("default")], buildContext(grantEnv(NAME))),
			),
		).toBe("default");
		let error = unwrapError(
			await plugin.call(
				"get",
				[value(NAME), value("default")],
				buildContext(grantEnv("OTHER_VAR")),
			),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
	});

	test("an unset variable without a fallback is a tool error naming it", async () => {
		let error = unwrapError(await plugin.call("get", [value(NAME)], buildContext(grantEnv(NAME))));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain(NAME);
		expect(error.message).toContain("is not set");
	});

	test("the variable name must be a string, not a bare word", async () => {
		let error = unwrapError(await plugin.call("get", [word(NAME)], buildContext(grantEnv(NAME))));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("string");
	});

	test("more than two arguments is a tool error", async () => {
		let error = unwrapError(
			await plugin.call("get", [value(NAME), value("a"), value("b")], buildContext(grantEnv(NAME))),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("at most two arguments");
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let error = unwrapError(await plugin.call("set", [], buildContext(grantEnv(NAME))));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('env has no tool named "set"');
	});
});
