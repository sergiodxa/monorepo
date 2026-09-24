/**
 * Tests for the `sf.*` schema helpers: each one's output and issue path, and their
 * composition with `remix/data-schema` objects, arrays, unions and checks over real field
 * definitions (`Priority`, `Cache-Status`, `Idempotency-Key`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { describe, expect, expectTypeOf, test } from "vitest";

import { sf } from "./schema.js";

import { Decimal, DisplayString, getField, parse, Token, ValidationError } from "./index.js";

/**
 * Validates a value synchronously.
 *
 * @param schema - The schema under test
 * @param value - The input
 * @returns The Standard Schema result
 */
function check<Output>(
	schema: StandardSchemaV1<unknown, Output>,
	value: unknown,
): StandardSchemaV1.Result<Output> {
	let result = schema["~standard"].validate(value);
	if (result instanceof Promise) throw new Error("Expected a synchronous schema");
	return result;
}

/**
 * Validates a value expected to fail, returning its issue paths.
 *
 * @param schema - The schema under test
 * @param value - The input
 * @returns Each issue's path
 */
function issuePaths(schema: StandardSchemaV1<unknown, unknown>, value: unknown): unknown[] {
	let result = check(schema, value);
	expect(result.issues).toBeDefined();
	return (result.issues ?? []).map((issue) => issue.path ?? []);
}

describe("bare item helpers", () => {
	test("integer accepts an Integer and rejects Decimals and out-of-range numbers", () => {
		expect(check(sf.integer(), 7)).toEqual({ value: 7 });
		expect(issuePaths(sf.integer(), new Decimal(7))).toEqual([[]]);
		expect(issuePaths(sf.integer(), 1.5)).toEqual([[]]);
		expect(issuePaths(sf.integer(), 1e15)).toEqual([[]]);
		expect(issuePaths(sf.integer(), "7")).toEqual([[]]);
	});

	test("decimal unwraps a Decimal and accepts an Integer, both as number", () => {
		expect(check(sf.decimal(), new Decimal(0.5))).toEqual({ value: 0.5 });
		expect(check(sf.decimal(), 2)).toEqual({ value: 2 });
		expect(issuePaths(sf.decimal(), new Token("a"))).toEqual([[]]);
	});

	test("token outputs the text and narrows to the allowed literals", () => {
		expect(check(sf.token(), new Token("HIT"))).toEqual({ value: "HIT" });
		expect(issuePaths(sf.token(), "HIT")).toEqual([[]]);
		let fwd = sf.token(["miss", "stale"]);
		expectTypeOf(fwd).toExtend<StandardSchemaV1<unknown, "miss" | "stale">>();
		expect(check(fwd, new Token("stale"))).toEqual({ value: "stale" });
		expect(issuePaths(fwd, new Token("bypass"))).toEqual([[]]);
	});

	test("displayString outputs the text and rejects a plain string", () => {
		expect(check(sf.displayString(), new DisplayString("fü"))).toEqual({ value: "fü" });
		expect(issuePaths(sf.displayString(), "fu")).toEqual([[]]);
	});

	test("bytes accepts a Byte Sequence", () => {
		let bytes = new Uint8Array([1, 2]);
		expect(check(sf.bytes(), bytes)).toEqual({ value: bytes });
		expect(issuePaths(sf.bytes(), "AQI=")).toEqual([[]]);
	});

	test("date accepts a Date", () => {
		let date = new Date(0);
		expect(check(sf.date(), date)).toEqual({ value: date });
		expect(issuePaths(sf.date(), 0)).toEqual([[]]);
	});
});

describe("item", () => {
	test("validates the value and parameters, keeping both", () => {
		let schema = sf.item(sf.integer(), s.object({ w: sf.integer() }));
		expectTypeOf(schema).toExtend<
			StandardSchemaV1<unknown, { value: number; params: { w: number } }>
		>();
		let parsed = parse("10;w=60", "item", schema);
		if (isFailure(parsed)) throw parsed.error;
		expect(parsed.data).toEqual({ value: 10, params: { w: 60 } });
	});

	test("passes parameters through untouched without a parameter schema", () => {
		let parsed = parse("a;x=1", "item", sf.item(sf.token()));
		if (isFailure(parsed)) throw parsed.error;
		expect(parsed.data.value).toBe("a");
		expect(parsed.data.params).toEqual({ x: 1 });
	});

	test("reports issues under value and params", () => {
		let schema = sf.item(sf.integer(), s.object({ w: sf.integer() }));
		expect(issuePaths(schema, { value: "a", params: { w: "b" } })).toEqual([
			["value"],
			["params", "w"],
		]);
	});

	test("rejects an Inner List and anything that is no Item", () => {
		let schema = sf.item(sf.integer());
		expect(issuePaths(schema, { items: [], params: {} })).toEqual([[]]);
		expect(issuePaths(schema, 1)).toEqual([[]]);
	});
});

describe("value", () => {
	test("outputs the bare value alone", () => {
		let parsed = parse('"abc";ignored', "item", sf.value(s.string()));
		if (isFailure(parsed)) throw parsed.error;
		expect(parsed.data).toBe("abc");
	});

	test("reports the value's issue under value", () => {
		expect(issuePaths(sf.value(s.string()), { value: 1, params: {} })).toEqual([["value"]]);
		expect(issuePaths(sf.value(s.string()), { items: [], params: {} })).toEqual([[]]);
	});
});

describe("innerList", () => {
	test("validates each item and the list's parameters", () => {
		let schema = sf.innerList(sf.value(sf.token()), s.object({ lvl: sf.integer() }));
		let list = parse("(a b);lvl=1", "list", s.array(schema));
		if (isFailure(list)) throw list.error;
		expect(list.data).toEqual([{ items: ["a", "b"], params: { lvl: 1 } }]);
	});

	test("reports issues under items and params", () => {
		let schema = sf.innerList(sf.value(sf.token()), s.object({ lvl: sf.integer() }));
		let parsed = parse('(a "b");lvl=x', "list", s.array(schema));
		expect(isFailure(parsed)).toBe(true);
		if (isSuccess(parsed) || !(parsed.error instanceof ValidationError)) return;
		expect(parsed.error.issues.map((issue) => issue.path)).toEqual([
			[0, "items", 1, "value"],
			[0, "params", "lvl"],
		]);
	});

	test("rejects an Item", () => {
		let schema = sf.innerList(sf.value(sf.token()));
		expect(issuePaths(schema, { value: 1, params: {} })).toEqual([[]]);
	});
});

/** RFC 9218 `Priority`: urgency 0 to 7, and the incremental flag. */
const PRIORITY = s.object({
	u: s.optional(sf.value(sf.integer().pipe(checks.min(0), checks.max(7)))),
	i: s.optional(sf.value(s.boolean())),
});

describe("field definitions", () => {
	test("reads Priority into typed values", () => {
		let headers = new Headers({ Priority: "u=5, i" });
		let priority = getField(headers, "Priority", "dictionary", PRIORITY);
		if (isFailure(priority)) throw priority.error;
		expectTypeOf(priority.data).toEqualTypeOf<{
			u: number | undefined;
			i: boolean | undefined;
		} | null>();
		expect(priority.data).toEqual({ u: 5, i: true });
	});

	test("fails Priority with an urgency out of range", () => {
		let priority = parse("u=9", "dictionary", PRIORITY);
		expect(isFailure(priority) && priority.error).toBeInstanceOf(ValidationError);
	});

	test("reads RFC 9211 Cache-Status hops", () => {
		let hop = sf.item(
			s.union([sf.token(), s.string()]),
			s.object({
				hit: s.optional(s.boolean()),
				fwd: s.optional(sf.token(["uri-miss", "stale"])),
				ttl: s.optional(sf.integer()),
			}),
		);
		let hops = parse('ExampleCache; hit; ttl=376, "Origin"; fwd=uri-miss', "list", s.array(hop));
		if (isFailure(hops)) throw hops.error;
		expect(hops.data).toEqual([
			{ value: "ExampleCache", params: { hit: true, ttl: 376 } },
			{ value: "Origin", params: { fwd: "uri-miss" } },
		]);
	});

	test("reads an Idempotency-Key", () => {
		let headers = new Headers({ "Idempotency-Key": '"8e03978e-40d5-43e8-bc93-6894a57f9324"' });
		let key = getField(headers, "Idempotency-Key", "item", sf.value(s.string()));
		expect(key).toEqual({ status: "success", data: "8e03978e-40d5-43e8-bc93-6894a57f9324" });
	});
});
