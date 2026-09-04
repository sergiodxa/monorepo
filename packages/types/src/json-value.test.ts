/**
 * Type-level tests for the JSON value type: the shapes `JSON.parse` produces
 * are assignable, and everything that changes type across a round trip is not.
 * `expectTypeOf` reports through the typecheck, so a regression fails `vp check`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import type { JSONValue } from "./json-value.js";

/**
 * Stands in for any API that takes JSON, bounding its type parameter rather
 * than typing the parameter itself, which is how a caller keeps its own shape.
 */
function enqueue<T extends JSONValue>(payload: T): T {
	return payload;
}

describe("JSONValue", () => {
	test("accepts every JSON primitive", () => {
		expectTypeOf<string>().toExtend<JSONValue>();
		expectTypeOf<number>().toExtend<JSONValue>();
		expectTypeOf<boolean>().toExtend<JSONValue>();
		expectTypeOf<null>().toExtend<JSONValue>();
	});

	test("recurses through arrays and objects to any depth", () => {
		expectTypeOf<{ tags: string[]; meta: { draft: boolean } }>().toExtend<JSONValue>();
		expectTypeOf<Array<{ id: number }>>().toExtend<JSONValue>();
		expectTypeOf<{ rows: Array<{ cells: number[] }> }>().toExtend<JSONValue>();
	});

	test("rejects a Date, which returns from a round trip as a string", () => {
		expectTypeOf<Date>().not.toExtend<JSONValue>();
		expectTypeOf<{ publishedAt: Date }>().not.toExtend<JSONValue>();
	});

	test("rejects what JSON has no notation for", () => {
		expectTypeOf<undefined>().not.toExtend<JSONValue>();
		expectTypeOf<() => number>().not.toExtend<JSONValue>();
		expectTypeOf<Map<string, string>>().not.toExtend<JSONValue>();
		expectTypeOf<bigint>().not.toExtend<JSONValue>();
		expectTypeOf<symbol>().not.toExtend<JSONValue>();
	});

	test("keeps the caller's shape when it bounds a type parameter", () => {
		let job = enqueue({ id: 1, tags: ["news"], draft: false });

		expectTypeOf(job.id).toEqualTypeOf<number>();
		expectTypeOf(job.tags).toEqualTypeOf<string[]>();
		expect(job.tags).toEqual(["news"]);
	});

	test("narrows a boolean to its literal, since the union names both", () => {
		let job = enqueue({ draft: false });
		expectTypeOf(job).toEqualTypeOf<{ draft: false }>();
		expect(job.draft).toBe(false);
	});

	test("describes the value JSON.parse hands back", () => {
		let parsed: JSONValue = JSON.parse(`{"id":1,"tags":["news"]}`) as JSONValue;
		expect(parsed).toEqual({ id: 1, tags: ["news"] });
	});
});
