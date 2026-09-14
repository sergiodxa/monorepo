/**
 * Type-level tests for the JSON primitive type: the four scalars are
 * assignable, the structures that nest them are not, and every primitive
 * remains a `JSONValue`, so the two stay in step as the leaf and the whole.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import type { JSONPrimitive } from "./json-primitive.js";
import type { JSONValue } from "./json-value.js";

/**
 * Stands in for any API that compares against a scalar, bounding its type
 * parameter rather than typing the parameter itself, which is how a caller
 * keeps its own literal type.
 */
function equals<T extends JSONPrimitive>(value: T): T {
	return value;
}

describe("JSONPrimitive", () => {
	test("accepts every JSON scalar", () => {
		expectTypeOf<string>().toExtend<JSONPrimitive>();
		expectTypeOf<number>().toExtend<JSONPrimitive>();
		expectTypeOf<boolean>().toExtend<JSONPrimitive>();
		expectTypeOf<null>().toExtend<JSONPrimitive>();
	});

	test("rejects the structures that nest scalars", () => {
		expectTypeOf<string[]>().not.toExtend<JSONPrimitive>();
		expectTypeOf<{ tier: string }>().not.toExtend<JSONPrimitive>();
		expectTypeOf<JSONValue>().not.toExtend<JSONPrimitive>();
	});

	test("rejects what JSON has no notation for", () => {
		expectTypeOf<undefined>().not.toExtend<JSONPrimitive>();
		expectTypeOf<Date>().not.toExtend<JSONPrimitive>();
		expectTypeOf<bigint>().not.toExtend<JSONPrimitive>();
		expectTypeOf<symbol>().not.toExtend<JSONPrimitive>();
	});

	test("is the leaf of the value type, so every primitive is also a value", () => {
		expectTypeOf<JSONPrimitive>().toExtend<JSONValue>();
	});

	test("keeps the caller's literal when it bounds a type parameter", () => {
		let tier = equals("pro");

		expectTypeOf(tier).toEqualTypeOf<"pro">();
		expect(tier).toBe("pro");
	});
});
