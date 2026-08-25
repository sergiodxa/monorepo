/**
 * Tests for argument validation.
 *
 * Arguments arrive from a language model, so the cases that matter are the ones a model
 * actually produces: a missing optional, an invented extra, a `null` where nothing was
 * meant, a number sent as a string. Each is asserted for the behaviour that keeps a call
 * useful — filled, dropped, treated as absent, refused — rather than for strictness.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { ObjectSchema } from "./schema";

import { validateArguments } from "./validate";

/** The argument schema most cases here are checked against. */
const SCHEMA: ObjectSchema = {
	type: "object",
	properties: {
		query: { type: "string", minLength: 1 },
		type: { type: "string", enum: ["article", "tutorial"] },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
		tags: { type: "array", items: { type: "string" } },
	},
	required: ["query"],
};

/** Reads the issue list off a failed validation. */
function issues(schema: ObjectSchema, value: unknown): readonly string[] {
	let result = validateArguments(schema, value);
	if (isSuccess(result)) throw new Error("expected validation to fail");
	return result.error.issues;
}

describe("validateArguments", () => {
	test("fills a default for an argument the caller left out", () => {
		expect(unwrap(validateArguments(SCHEMA, { query: "remix" }))).toEqual({
			query: "remix",
			limit: 20,
		});
	});

	test("drops a property the schema does not declare", () => {
		let checked = unwrap(validateArguments(SCHEMA, { query: "remix", sortBy: "relevance" }));

		expect(checked).not.toHaveProperty("sortBy");
		expect(checked.query).toBe("remix");
	});

	test("treats null as absent, so an optional argument still defaults", () => {
		let checked = unwrap(validateArguments(SCHEMA, { query: "remix", type: null, limit: null }));

		expect(checked).not.toHaveProperty("type");
		expect(checked.limit).toBe(20);
	});

	test("accepts a call with no arguments at all when nothing is required", () => {
		let schema: ObjectSchema = {
			type: "object",
			properties: { limit: { type: "integer", default: 10 } },
		};

		expect(unwrap(validateArguments(schema, undefined))).toEqual({ limit: 10 });
	});

	test("refuses a missing required argument", () => {
		expect(issues(SCHEMA, {})).toEqual(["query: is required"]);
	});

	test("refuses a value outside an enum, naming what was allowed", () => {
		expect(issues(SCHEMA, { query: "remix", type: "bookmark" })).toEqual([
			"type: expected one of article, tutorial",
		]);
	});

	test("refuses a number sent as a string rather than coercing it", () => {
		expect(issues(SCHEMA, { query: "remix", limit: "20" })).toEqual(["limit: expected a number"]);
	});

	test("refuses a fractional value for an integer", () => {
		expect(issues(SCHEMA, { query: "remix", limit: 2.5 })).toEqual([
			"limit: expected a whole number",
		]);
	});

	test("refuses NaN, which every numeric bound would otherwise pass", () => {
		expect(issues(SCHEMA, { query: "remix", limit: Number.NaN })).toEqual([
			"limit: expected a number",
		]);
	});

	test("reports every failure at once rather than stopping at the first", () => {
		expect(issues(SCHEMA, { limit: 0, type: "bookmark" })).toEqual([
			"query: is required",
			"type: expected one of article, tutorial",
			"limit: expected 1 or more",
		]);
	});

	test("names the index of the array element that failed", () => {
		expect(issues(SCHEMA, { query: "remix", tags: ["remix", 3] })).toEqual([
			"tags[1]: expected a string",
		]);
	});

	test("refuses an array where a scalar was declared", () => {
		expect(issues(SCHEMA, { query: ["remix"] })).toEqual(["query: expected a string"]);
	});

	test("refuses arguments that are not an object", () => {
		expect(issues(SCHEMA, "remix")).toEqual(["(root): expected an object"]);
	});

	test("checks length and pattern bounds on a string", () => {
		let schema: ObjectSchema = {
			type: "object",
			properties: { slug: { type: "string", maxLength: 4, pattern: "^[a-z]+$" } },
			required: ["slug"],
		};

		expect(issues(schema, { slug: "Remix-V3" })).toEqual([
			"slug: expected at most 4 characters",
			"slug: expected to match ^[a-z]+$",
		]);
	});

	test("checks a nested object's properties by path", () => {
		let schema: ObjectSchema = {
			type: "object",
			properties: {
				page: {
					type: "object",
					properties: { size: { type: "integer", maximum: 50 } },
					required: ["size"],
				},
			},
			required: ["page"],
		};

		expect(issues(schema, { page: { size: 500 } })).toEqual(["page.size: expected 50 or less"]);
		expect(isFailure(validateArguments(schema, { page: { size: 500 } }))).toBe(true);
	});

	test("checks array length bounds", () => {
		let schema: ObjectSchema = {
			type: "object",
			properties: { tags: { type: "array", items: { type: "string" }, minItems: 1 } },
			required: ["tags"],
		};

		expect(issues(schema, { tags: [] })).toEqual(["tags: expected at least 1 items"]);
	});
});
