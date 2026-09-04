/**
 * Type-level tests for the JSON-writable type: it admits everything the JSON
 * value type does plus objects carrying a `toJSON`, and the runtime assertions
 * show the round trip those objects break, which is why the two types differ.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import type { JSONSerializable } from "./json-serializable.js";
import type { JSONValue } from "./json-value.js";

describe("JSONSerializable", () => {
	test("accepts everything the JSON value type accepts", () => {
		expectTypeOf<JSONValue>().toExtend<JSONSerializable>();
		expectTypeOf<{ id: number; tags: string[] }>().toExtend<JSONSerializable>();
	});

	test("accepts a built-in that serializes itself", () => {
		expectTypeOf<Date>().toExtend<JSONSerializable>();
		expectTypeOf<URL>().toExtend<JSONSerializable>();
	});

	test("accepts a custom class that returns JSON from toJSON", () => {
		class Money {
			constructor(private cents: number) {}

			toJSON() {
				return { cents: this.cents, currency: "USD" };
			}
		}

		expectTypeOf<Money>().toExtend<JSONSerializable>();
		expect(JSON.stringify(new Money(500))).toBe(`{"cents":500,"currency":"USD"}`);
	});

	test("reaches a toJSON nested at any depth", () => {
		expectTypeOf<{ post: { publishedAt: Date } }>().toExtend<JSONSerializable>();
		expectTypeOf<Date[]>().toExtend<JSONSerializable>();
	});

	test("rejects a toJSON that returns something JSON cannot write", () => {
		expectTypeOf<{ toJSON(): Map<string, string> }>().not.toExtend<JSONSerializable>();
		expectTypeOf<{ toJSON(): undefined }>().not.toExtend<JSONSerializable>();
	});

	test("rejects a value with no JSON notation and no toJSON", () => {
		expectTypeOf<undefined>().not.toExtend<JSONSerializable>();
		expectTypeOf<() => number>().not.toExtend<JSONSerializable>();
		expectTypeOf<Map<string, string>>().not.toExtend<JSONSerializable>();
		expectTypeOf<Set<number>>().not.toExtend<JSONSerializable>();
	});

	test("stays wider than the JSON value type, which the round trip explains", () => {
		expectTypeOf<JSONSerializable>().not.toExtend<JSONValue>();

		let publishedAt = new Date("2026-09-04T00:00:00.000Z");
		let parsed = JSON.parse(JSON.stringify({ publishedAt })) as { publishedAt: unknown };

		expect(parsed.publishedAt).toBe("2026-09-04T00:00:00.000Z");
		expect(parsed.publishedAt).not.toBeInstanceOf(Date);
	});
});
