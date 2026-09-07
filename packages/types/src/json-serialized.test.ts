/**
 * Type-level tests for the JSON round-trip type, each paired with the
 * `JSON.stringify` result it claims to describe, so a type that drifts from
 * what the runtime actually writes fails here rather than at a call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import type { JSONSerialized } from "./json-serialized.js";
import type { JSONValue } from "./json-value.js";

describe("JSONSerialized", () => {
	test("leaves a value that already survives the round trip alone", () => {
		expectTypeOf<JSONSerialized<string>>().toEqualTypeOf<string>();
		expectTypeOf<JSONSerialized<number>>().toEqualTypeOf<number>();
		expectTypeOf<JSONSerialized<boolean>>().toEqualTypeOf<boolean>();
		expectTypeOf<JSONSerialized<null>>().toEqualTypeOf<null>();
		expectTypeOf<JSONSerialized<JSONValue>>().toEqualTypeOf<JSONValue>();
		expectTypeOf<JSONSerialized<{ id: number; tags: string[] }>>().toEqualTypeOf<{
			id: number;
			tags: string[];
		}>();
	});

	test("replaces a value that stands in for itself with what toJSON returns", () => {
		expectTypeOf<JSONSerialized<Date>>().toEqualTypeOf<string>();
		expectTypeOf<JSONSerialized<URL>>().toEqualTypeOf<string>();

		expect(JSON.parse(JSON.stringify(new Date("2026-09-07T00:00:00.000Z")))).toBe(
			"2026-09-07T00:00:00.000Z",
		);
		expect(JSON.parse(JSON.stringify(new URL("https://example.com")))).toBe("https://example.com/");
	});

	test("reaches a toJSON nested at any depth", () => {
		expectTypeOf<JSONSerialized<{ post: { publishedAt: Date } }>>().toEqualTypeOf<{
			post: { publishedAt: string };
		}>();
		expectTypeOf<JSONSerialized<Date[]>>().toEqualTypeOf<string[]>();
	});

	test("keeps an optional property optional, since it may not be written", () => {
		expectTypeOf<JSONSerialized<{ id: number; note?: string }>>().toEqualTypeOf<{
			id: number;
			note?: string;
		}>();

		expect(JSON.stringify({ id: 1, note: undefined })).toBe(`{"id":1}`);
	});

	test("drops a property JSON cannot write", () => {
		expectTypeOf<JSONSerialized<{ id: number; edit: () => void }>>().toEqualTypeOf<{
			id: number;
		}>();
		expectTypeOf<JSONSerialized<{ id: number; missing: undefined }>>().toEqualTypeOf<{
			id: number;
		}>();

		let written = JSON.stringify({ id: 1, edit: () => undefined, missing: undefined });
		expect(written).toBe(`{"id":1}`);
	});

	test("writes an unwritable array element as null, since a slot cannot be dropped", () => {
		expectTypeOf<JSONSerialized<undefined[]>>().toEqualTypeOf<null[]>();
		expectTypeOf<JSONSerialized<Array<() => void>>>().toEqualTypeOf<null[]>();

		expect(JSON.stringify([undefined, () => undefined])).toBe("[null,null]");
	});

	test("keeps a tuple's length and per-slot types", () => {
		expectTypeOf<JSONSerialized<[string, Date]>>().toEqualTypeOf<[string, string]>();

		expect(JSON.parse(JSON.stringify(["a", new Date(0)]))).toStrictEqual([
			"a",
			"1970-01-01T00:00:00.000Z",
		]);
	});

	test("resolves to never for a value JSON cannot write at all", () => {
		expectTypeOf<JSONSerialized<undefined>>().toEqualTypeOf<never>();
		expectTypeOf<JSONSerialized<() => number>>().toEqualTypeOf<never>();
		expectTypeOf<JSONSerialized<symbol>>().toEqualTypeOf<never>();

		expect(JSON.stringify(undefined)).toBeUndefined();
	});

	test("widens to the JSON value type below the nesting it tracks", () => {
		/** Wraps `T` in `depth` levels of object nesting. */
		type Nest<T, Depth extends number, Levels extends 0[] = []> = Levels["length"] extends Depth
			? T
			: { deeper: Nest<T, Depth, [...Levels, 0]> };

		expectTypeOf<JSONSerialized<Nest<Date, 8>>>().toEqualTypeOf<Nest<string, 8>>();
		expectTypeOf<JSONSerialized<Nest<Date, 12>>>().toEqualTypeOf<Nest<JSONValue, 9>>();
	});

	test("describes the declared shape, which is not the shape that is written", () => {
		class Money {
			constructor(private cents: number) {}

			get dollars(): number {
				return this.cents / 100;
			}
		}

		expectTypeOf<JSONSerialized<Money>>().toEqualTypeOf<{ readonly dollars: number }>();

		expect(JSON.stringify(new Money(500))).toBe(`{"cents":500}`);
	});
});
