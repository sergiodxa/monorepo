/**
 * Tests that every combinator, check and coercion validates exactly as its
 * `remix/data-schema` counterpart: same values out, same issues, for inputs on both
 * sides of each rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as ds from "remix/data-schema";
import * as dsChecks from "remix/data-schema/checks";
import * as dsCoerce from "remix/data-schema/coerce";
import { describe, expect, test } from "vitest";

import * as checks from "./checks.js";
import * as coerce from "./coerce.js";

import * as s from "./index.js";

/** One pairing: this package's schema, its data-schema counterpart, and inputs to compare them on. */
interface Case {
	name: string;
	ours: StandardSchemaV1;
	theirs: StandardSchemaV1;
	inputs: unknown[];
}

const CASES: Case[] = [
	{ name: "any", ours: s.any(), theirs: ds.any(), inputs: [1, "a", null, undefined] },
	{ name: "string", ours: s.string(), theirs: ds.string(), inputs: ["a", 1, null] },
	{ name: "number", ours: s.number(), theirs: ds.number(), inputs: [1, 1.5, Number.NaN, "1"] },
	{ name: "boolean", ours: s.boolean(), theirs: ds.boolean(), inputs: [true, "true"] },
	{ name: "null_", ours: s.null_(), theirs: ds.null_(), inputs: [null, undefined] },
	{ name: "literal", ours: s.literal("a"), theirs: ds.literal("a"), inputs: ["a", "b"] },
	{ name: "enum_", ours: s.enum_(["a", 1]), theirs: ds.enum_(["a", 1]), inputs: ["a", 1, "1"] },
	{
		name: "array",
		ours: s.array(s.string()),
		theirs: ds.array(ds.string()),
		inputs: [["a"], ["a", 2], "a"],
	},
	{
		name: "object",
		ours: s.object({ a: s.string(), b: s.optional(s.number()) }),
		theirs: ds.object({ a: ds.string(), b: ds.optional(ds.number()) }),
		inputs: [{ a: "x" }, { a: "x", b: 1, c: true }, { b: "1" }, []],
	},
	{
		name: "object with unknownKeys error",
		ours: s.object({ a: s.string() }, { unknownKeys: "error" }),
		theirs: ds.object({ a: ds.string() }, { unknownKeys: "error" }),
		inputs: [{ a: "x" }, { a: "x", c: 1 }],
	},
	{
		name: "object with unknownKeys passthrough",
		ours: s.object({ a: s.string() }, { unknownKeys: "passthrough" }),
		theirs: ds.object({ a: ds.string() }, { unknownKeys: "passthrough" }),
		inputs: [{ a: "x", c: 1 }],
	},
	{
		name: "nullable",
		ours: s.nullable(s.string()),
		theirs: ds.nullable(ds.string()),
		inputs: [null, "a", 1],
	},
	{
		name: "defaulted",
		ours: s.defaulted(s.number(), 5),
		theirs: ds.defaulted(ds.number(), 5),
		inputs: [undefined, 1, "1"],
	},
	{
		name: "record",
		ours: s.record(s.string(), s.number()),
		theirs: ds.record(ds.string(), ds.number()),
		inputs: [{ a: 1 }, { a: "1" }, null],
	},
	{
		name: "tuple",
		ours: s.tuple([s.string(), s.number()]),
		theirs: ds.tuple([ds.string(), ds.number()]),
		inputs: [["a", 1], ["a"], [1, "a"]],
	},
	{
		name: "union",
		ours: s.union([s.string(), s.number()]),
		theirs: ds.union([ds.string(), ds.number()]),
		inputs: ["a", 1, true],
	},
	{
		name: "variant",
		ours: s.variant("kind", { a: s.object({ kind: s.literal("a"), x: s.string() }) }),
		theirs: ds.variant("kind", { a: ds.object({ kind: ds.literal("a"), x: ds.string() }) }),
		inputs: [{ kind: "a", x: "1" }, { kind: "b" }, { x: "1" }],
	},
	{
		name: "minLength and maxLength",
		ours: s.string().pipe(checks.minLength(2), checks.maxLength(3)),
		theirs: ds.string().pipe(dsChecks.minLength(2), dsChecks.maxLength(3)),
		inputs: ["a", "ab", "abcd"],
	},
	{
		name: "min and max",
		ours: s.number().pipe(checks.min(1), checks.max(3)),
		theirs: ds.number().pipe(dsChecks.min(1), dsChecks.max(3)),
		inputs: [0, 2, 4],
	},
	{
		name: "email",
		ours: s.string().pipe(checks.email()),
		theirs: ds.string().pipe(dsChecks.email()),
		inputs: ["a@b.co", "nope"],
	},
	{
		name: "url",
		ours: s.string().pipe(checks.url()),
		theirs: ds.string().pipe(dsChecks.url()),
		inputs: ["https://example.com", "nope"],
	},
	{
		name: "coerce.number",
		ours: coerce.number(),
		theirs: dsCoerce.number(),
		inputs: ["1", " ", 2],
	},
	{
		name: "coerce.boolean",
		ours: coerce.boolean(),
		theirs: dsCoerce.boolean(),
		inputs: ["TRUE", "no", false],
	},
	{
		name: "coerce.date",
		ours: coerce.date(),
		theirs: dsCoerce.date(),
		inputs: ["2026-09-24T00:00:00Z", "nope"],
	},
	{ name: "coerce.bigint", ours: coerce.bigint(), theirs: dsCoerce.bigint(), inputs: ["12", 1.5] },
	{ name: "coerce.string", ours: coerce.string(), theirs: dsCoerce.string(), inputs: [1, {}] },
];

describe("validation matches remix/data-schema", () => {
	test.each(CASES)("$name", ({ ours, theirs, inputs }) => {
		for (let input of inputs) {
			expect(ours["~standard"].validate(input)).toEqual(theirs["~standard"].validate(input));
		}
	});

	test("integer is number plus Number.isInteger", () => {
		expect(s.parseSafe(s.integer(), 2).success).toBe(true);
		expect(s.parseSafe(s.integer(), 2.5)).toEqual({
			success: false,
			issues: [{ message: "Expected integer" }],
		});
		expect(s.parseSafe(s.integer(), "2")).toEqual(ds.parseSafe(ds.number(), "2"));
	});

	test("pattern, minItems and maxItems report their own codes through an error map", () => {
		let codes: string[] = [];
		let errorMap = (context: { code: string }) => {
			codes.push(context.code);
			return undefined;
		};
		s.parseSafe(s.string().pipe(checks.pattern(/^a/g)), "b", { errorMap });
		s.parseSafe(s.array(s.string()).pipe(checks.minItems(1)), [], { errorMap });
		s.parseSafe(s.array(s.string()).pipe(checks.maxItems(0)), ["a"], { errorMap });

		expect(codes).toEqual(["string.pattern", "array.min_items", "array.max_items"]);
	});

	test("a global pattern checks every value, carrying no lastIndex between calls", () => {
		let schema = s.string().pipe(checks.pattern(/a/g));
		expect([s.parseSafe(schema, "a").success, s.parseSafe(schema, "a").success]).toEqual([
			true,
			true,
		]);
	});
});
