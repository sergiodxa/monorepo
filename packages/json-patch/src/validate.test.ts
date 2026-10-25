/**
 * The shape checks `validate` and `parse` run before a patch is applied: required members,
 * well-formed pointers, a move into its own child, and the members section 4 says to ignore.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse, stringify } from "./parse.js";
import { validate } from "./validate.js";

describe("validate", () => {
	test("returns typed operations without unrecognized members", () => {
		expect(unwrap(validate([{ op: "add", path: "/a", value: null, extra: 1 }]))).toEqual([
			{ op: "add", path: "/a", value: null },
		]);
	});

	test.each([
		["a non-array", { op: "add" }, null],
		["a non-object operation", ["add"], 0],
		["an unknown op", [{ op: "spam", path: "/a" }], 0],
		["a missing path", [{ op: "remove" }], 0],
		["a path that is not a pointer", [{ op: "remove", path: "a" }], 0],
		["a bad escape", [{ op: "remove", path: "/~2" }], 0],
		["a missing value", [{ op: "test", path: "/a" }], 0],
		["a missing from", [{ op: "copy", path: "/a" }], 0],
		["a move into its own child", [{ op: "move", from: "/a", path: "/a/b" }], 0],
		[
			"a later bad operation",
			[
				{ op: "remove", path: "/a" },
				{ op: "copy", path: "/b" },
			],
			1,
		],
	])("refuses %s", (_label, patch, index) => {
		let result = validate(patch);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.reason).toBe("invalid-patch");
			expect(result.error.index).toBe(index);
		}
	});

	test("accepts a move to a sibling that shares a prefix", () => {
		expect(unwrap(validate([{ op: "move", from: "/a", path: "/ab" }]))).toHaveLength(1);
	});
});

describe("parse", () => {
	test("reads and validates patch text", () => {
		expect(unwrap(parse('[{"op":"remove","path":"/a"}]'))).toEqual([{ op: "remove", path: "/a" }]);
	});

	test("fails on text that is not JSON", () => {
		let result = parse("[{");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.index).toBeNull();
	});

	test("round-trips through stringify", () => {
		let text = stringify([{ op: "copy", from: "/a", path: "/b" }]);
		expect(unwrap(parse(text))).toEqual([{ op: "copy", from: "/a", path: "/b" }]);
	});
});
