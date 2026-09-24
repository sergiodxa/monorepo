/**
 * Checks that `diff` generates the smallest patch that `apply` turns back into the
 * target, and that it refuses a target a merge patch cannot express.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSONValue } from "./json-value.js";

import { apply } from "./apply.js";
import { diff, UnrepresentableChangeError } from "./diff.js";
import { APPENDIX_A_EXAMPLES, SECTION_3_EXAMPLE } from "./fixtures/rfc7396.js";

/** Whether a value holds `null` as an object member at any depth, which `diff` refuses. */
function hasNullMember(value: JSONValue): boolean {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	return Object.values(value).some((member) => member === null || hasNullMember(member));
}

describe("diff", () => {
	test("is {} for equal objects", () => {
		expect(unwrap(diff({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }))).toEqual({});
	});

	test("reproduces the Section 3 patch", () => {
		let { original, patch, result } = SECTION_3_EXAMPLE;
		expect(unwrap(diff(original, result))).toEqual(patch);
	});

	test("sets removed members to null and sends changed arrays whole", () => {
		let patch = diff({ a: 1, b: [1, 2], c: { d: 1, e: 2 } }, { b: [1, 3], c: { d: 1 } });
		expect(unwrap(patch)).toEqual({ a: null, b: [1, 3], c: { e: null } });
	});

	test("replaces a non-object whole", () => {
		expect(unwrap(diff(5, 5))).toBe(5);
		expect(unwrap(diff({ a: 1 }, [1]))).toEqual([1]);
		expect(unwrap(diff([1], { a: 1 }))).toEqual({ a: 1 });
		expect(unwrap(diff({ a: 1 }, null))).toBeNull();
	});

	test("keeps null inside arrays, which are replaced whole", () => {
		expect(unwrap(diff({ a: [1] }, { a: [null] }))).toEqual({ a: [null] });
	});

	test.each(
		[SECTION_3_EXAMPLE, ...APPENDIX_A_EXAMPLES]
			.filter(({ result }) => !hasNullMember(result))
			.map((example, index) => ({ ...example, row: index })),
	)("round-trips example $row", ({ original, result }) => {
		let patch = diff(original, result);
		expect(isSuccess(patch)).toBe(true);
		expect(apply(original, unwrap(patch))).toEqual(result);
	});

	test("refuses a target that sets a member to null, naming it by pointer", () => {
		let patch = diff({ a: { "b/c": 1 } }, { a: { "b/c": null } });

		expect(isFailure(patch)).toBe(true);
		if (!isFailure(patch)) return;
		expect(patch.error).toBeInstanceOf(UnrepresentableChangeError);
		expect(patch.error.pointer).toBe("/a/b~1c");
	});

	test("refuses a null nested inside an added object", () => {
		let patch = diff({}, { a: { "~x": { y: null } } });

		expect(isFailure(patch)).toBe(true);
		if (isFailure(patch)) expect(patch.error.pointer).toBe("/a/~0x/y");
	});

	test("refuses a null member the source already had, since the patch would drop it", () => {
		let patch = diff({ e: null }, { e: null, a: 1 });
		expect(isFailure(patch)).toBe(true);
	});
});
