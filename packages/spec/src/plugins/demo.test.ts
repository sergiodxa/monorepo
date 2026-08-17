/**
 * In-process tests for the demo reference plugin: descriptor shape, the say
 * echo, the upper observable, and its argument validation errors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, success } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { ToolContext } from "../plugin";
import type { Value } from "../values";

import { createDemoPlugin } from "./demo";

/** A minimal context; the demo plugin never touches workspace or grants. */
function stubContext(): ToolContext {
	return {
		workspace: {
			root: "/tmp/spec-demo-test-workspace",
			resolve(target) {
				return success(target);
			},
			async cleanup() {
				return undefined;
			},
		},
		permissions: {
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
		},
	};
}

describe("createDemoPlugin", () => {
	test("uses the demo namespace", () => {
		expect(createDemoPlugin().namespace).toBe("demo");
	});

	test("describes say as a permissionless action and upper as a permissionless observable", () => {
		let descriptors = createDemoPlugin().describe();
		expect(descriptors.map((descriptor) => descriptor.name)).toEqual(["say", "upper"]);
		let say = descriptors[0];
		let upper = descriptors[1];
		expect(say?.kind).toBe("action");
		expect(say?.requires).toBeUndefined();
		expect(say?.params).toEqual([
			{ name: "text", kind: "value", required: true, summary: "The value to echo back." },
		]);
		expect(upper?.kind).toBe("observable");
		expect(upper?.requires).toBeUndefined();
		expect(upper?.params).toEqual([
			{ name: "text", kind: "value", required: true, summary: "The text to uppercase." },
		]);
	});

	test("say echoes a string back", async () => {
		let plugin = createDemoPlugin();
		let result = await plugin.call("say", [{ kind: "value", value: "hello" }], stubContext());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("hello");
	});

	test("say echoes a structured value back untouched", async () => {
		let plugin = createDemoPlugin();
		let value: Value = { user: { name: "Ada" }, tags: ["a", "b"], count: 2 };
		let result = await plugin.call("say", [{ kind: "value", value }], stubContext());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toEqual(value);
	});

	test("say rejects a word argument", async () => {
		let plugin = createDemoPlugin();
		let result = await plugin.call("say", [{ kind: "word", word: "exists" }], stubContext());
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.code).toBe("tool-error");
			expect(result.error.message).toContain("one value argument");
		}
	});

	test("say rejects a missing argument", async () => {
		let plugin = createDemoPlugin();
		let result = await plugin.call("say", [], stubContext());
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("tool-error");
	});

	test("say rejects extra arguments", async () => {
		let plugin = createDemoPlugin();
		let result = await plugin.call(
			"say",
			[
				{ kind: "value", value: "a" },
				{ kind: "value", value: "b" },
			],
			stubContext(),
		);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("tool-error");
	});

	test("upper uppercases its text", async () => {
		let plugin = createDemoPlugin();
		let result = await plugin.call("upper", [{ kind: "value", value: "hello" }], stubContext());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("HELLO");
	});

	test("upper rejects a non-string value", async () => {
		let plugin = createDemoPlugin();
		let result = await plugin.call("upper", [{ kind: "value", value: 42 }], stubContext());
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.code).toBe("tool-error");
			expect(result.error.message).toContain("expects a string");
			expect(result.error.message).toContain("42");
		}
	});

	test("an unknown tool fails naming the accepted tools", async () => {
		let plugin = createDemoPlugin();
		let result = await plugin.call("shout", [{ kind: "value", value: "x" }], stubContext());
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.code).toBe("tool-error");
			expect(result.error.message).toContain('"demo.shout"');
			expect(result.error.message).toContain("say, upper");
		}
	});
});
