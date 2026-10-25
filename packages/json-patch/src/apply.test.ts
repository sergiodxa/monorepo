/**
 * The guarantees `apply` adds on top of the suite: one failing operation rolls back the
 * whole patch, failures say which operation and why, and inputs are never shared or mutated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSONValue } from "./json-value.js";
import type { Operation } from "./operation.js";

import { apply } from "./apply.js";
import { JsonPatchError } from "./error.js";

/** The failure `apply` returned, or a test failure when it succeeded. */
function failureOf(document: JSONValue, patch: Operation[]): JsonPatchError {
	let result = apply(document, patch);
	if (!isFailure(result)) throw new Error("expected the patch to fail");
	return result.error;
}

describe("apply", () => {
	test("leaves the document untouched when a later operation fails", () => {
		let document = { a: 1, list: [1, 2] };
		let error = failureOf(document, [
			{ op: "replace", path: "/a", value: 2 },
			{ op: "add", path: "/list/-", value: 3 },
			{ op: "test", path: "/a", value: 1 },
		]);

		expect(error).toBeInstanceOf(JsonPatchError);
		expect(error.reason).toBe("test-failed");
		expect(error.index).toBe(2);
		expect(document).toEqual({ a: 1, list: [1, 2] });
	});

	test("reports a missing path as unresolvable with its operation index", () => {
		let error = failureOf({ a: 1 }, [
			{ op: "test", path: "/a", value: 1 },
			{ op: "remove", path: "/b" },
		]);
		expect(error.reason).toBe("unresolvable");
		expect(error.index).toBe(1);
		expect(error.message).toMatch(/^Operation 1: /);
	});

	test("refuses a malformed operation before running any", () => {
		let error = failureOf({ a: 1 }, [
			{ op: "remove", path: "/a" },
			{ op: "add", path: "a" } as unknown as Operation,
		]);
		expect(error.reason).toBe("invalid-patch");
		expect(error.index).toBe(1);
	});

	test("returns a result that shares nothing with the document or the patch", () => {
		let document = { keep: { deep: [1] } };
		let value = { nested: [1] };
		let result = unwrap(apply(document, [{ op: "add", path: "/added", value }])) as {
			keep: { deep: number[] };
			added: { nested: number[] };
		};

		result.keep.deep.push(2);
		result.added.nested.push(2);

		expect(document).toEqual({ keep: { deep: [1] } });
		expect(value).toEqual({ nested: [1] });
	});

	test("copies independently of the source", () => {
		let result = unwrap(
			apply({ a: { b: [1] } }, [
				{ op: "copy", from: "/a", path: "/c" },
				{ op: "add", path: "/c/b/-", value: 2 },
			]),
		);
		expect(result).toEqual({ a: { b: [1] }, c: { b: [1, 2] } });
	});

	test("replaces and tests the whole document at the empty pointer", () => {
		expect(unwrap(apply("foo", [{ op: "replace", path: "", value: "bar" }]))).toBe("bar");
		expect(unwrap(apply({ a: 1 }, [{ op: "test", path: "", value: { a: 1 } }]))).toEqual({ a: 1 });
	});

	test("refuses to remove the whole document", () => {
		expect(failureOf({ a: 1 }, [{ op: "remove", path: "" }]).reason).toBe("unresolvable");
	});

	test("moves a value to the root", () => {
		expect(unwrap(apply({ a: { b: 1 } }, [{ op: "move", from: "/a", path: "" }]))).toEqual({
			b: 1,
		});
	});

	test("fails a move to the same location when the source is missing", () => {
		expect(failureOf({}, [{ op: "move", from: "/a", path: "/a" }]).reason).toBe("unresolvable");
	});

	test("keeps a member named __proto__ as data", () => {
		let result = unwrap(apply({}, [{ op: "add", path: "/__proto__", value: { polluted: true } }]));
		expect(Object.hasOwn(result as object, "__proto__")).toBe(true);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	test("refuses '-' outside add", () => {
		expect(failureOf([1], [{ op: "replace", path: "/-", value: 2 }]).reason).toBe("unresolvable");
	});
});
