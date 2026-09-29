/**
 * Tests for argument validation.
 *
 * Arguments arrive from a language model, so the cases that matter are the ones a model
 * actually produces: a missing optional, an invented extra, a `null` where nothing was
 * meant, a number sent as a string. Each is asserted for the behaviour that keeps a call
 * useful: filled, dropped, treated as absent, or refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { Tool, ToolSchema } from "./tools.js";

import { tool } from "./tools.js";
import { validateArguments } from "./validate.js";

/** The tool most cases here are checked against. */
const SEARCH = tool("search", {
	description: "Searches posts.",
	input: s.object({
		query: s.string().pipe(checks.minLength(1)),
		type: s.optional(s.enum_(["article", "tutorial"])),
		limit: s.defaulted(s.integer().pipe(checks.min(1), checks.max(100)), 20),
		tags: s.optional(s.array(s.string())),
	}),
});

/** Declares a throwaway tool around `input`, for cases needing a schema of their own. */
function withInput<Schema extends ToolSchema>(input: Schema): Tool<Schema> {
	return tool("case", { description: "A case.", input });
}

/** Reads the issue list off a failed validation. */
function issues(declared: Tool, value: unknown): readonly string[] {
	let result = validateArguments(declared, value);
	if (isSuccess(result)) throw new Error("expected validation to fail");
	return result.error.issues;
}

describe("validateArguments", () => {
	test("fills a default for an argument the caller left out", () => {
		expect(unwrap(validateArguments(SEARCH, { query: "remix" }))).toEqual({
			query: "remix",
			limit: 20,
		});
	});

	test("types the parsed arguments from the schema's output side", () => {
		let checked = unwrap(validateArguments(SEARCH, { query: "remix" }));

		expectTypeOf(checked.limit).toEqualTypeOf<number>();
		expectTypeOf(checked.type).toEqualTypeOf<"article" | "tutorial" | undefined>();
	});

	test("drops a property the schema does not declare", () => {
		let checked = unwrap(validateArguments(SEARCH, { query: "remix", sortBy: "relevance" }));

		expect(checked).not.toHaveProperty("sortBy");
		expect(checked.query).toBe("remix");
	});

	test("treats null as absent, so an optional argument still defaults", () => {
		let checked = unwrap(validateArguments(SEARCH, { query: "remix", type: null, limit: null }));

		expect(checked).not.toHaveProperty("type");
		expect(checked.limit).toBe(20);
	});

	test("treats null as absent inside nested objects and array items", () => {
		let declared = withInput(
			s.object({
				page: s.object({ size: s.defaulted(s.integer(), 10) }),
				filters: s.array(s.object({ tag: s.optional(s.string()) })),
			}),
		);

		expect(
			unwrap(validateArguments(declared, { page: { size: null }, filters: [{ tag: null }] })),
		).toEqual({ page: { size: 10 }, filters: [{}] });
	});

	test("keeps null for a property whose schema accepts it", () => {
		let declared = withInput(s.object({ cursor: s.nullable(s.string()) }));

		expect(unwrap(validateArguments(declared, { cursor: null }))).toEqual({ cursor: null });
	});

	test("accepts a call with no arguments at all when nothing is required", () => {
		let declared = withInput(s.object({ limit: s.defaulted(s.integer(), 10) }));

		expect(unwrap(validateArguments(declared, undefined))).toEqual({ limit: 10 });
		expect(unwrap(validateArguments(declared, null))).toEqual({ limit: 10 });
	});

	test("yields what the schema's transforms produce", () => {
		let declared = withInput(
			s.object({ slug: s.string().transform((slug) => slug.toLowerCase()) }),
		);

		expect(unwrap(validateArguments(declared, { slug: "Remix-V3" }))).toEqual({ slug: "remix-v3" });
	});

	test("refuses a missing required argument, naming it as required", () => {
		expect(issues(SEARCH, {})).toEqual(["query: Required"]);
	});

	test("refuses a value outside an enum, naming what was allowed", () => {
		expect(issues(SEARCH, { query: "remix", type: "bookmark" })).toEqual([
			"type: Expected one of: article, tutorial",
		]);
	});

	test("refuses a number sent as a string rather than coercing it", () => {
		expect(issues(SEARCH, { query: "remix", limit: "20" })).toEqual(["limit: Expected number"]);
	});

	test("refuses a fractional value for an integer", () => {
		expect(issues(SEARCH, { query: "remix", limit: 2.5 })).toEqual(["limit: Expected integer"]);
	});

	test("refuses NaN, which every numeric bound would otherwise pass", () => {
		expect(issues(SEARCH, { query: "remix", limit: Number.NaN })).toEqual([
			"limit: Expected number",
		]);
	});

	test("reports every failure at once rather than stopping at the first", () => {
		expect(issues(SEARCH, { limit: 0, type: "bookmark" })).toEqual([
			"query: Required",
			"type: Expected one of: article, tutorial",
			"limit: Expected number greater than or equal to 1",
		]);
	});

	test("names the index of the array element that failed", () => {
		expect(issues(SEARCH, { query: "remix", tags: ["remix", 3] })).toEqual([
			"tags[1]: Expected string",
		]);
	});

	test("refuses an array where a scalar was declared", () => {
		expect(issues(SEARCH, { query: ["remix"] })).toEqual(["query: Expected string"]);
	});

	test("refuses arguments that are not an object", () => {
		expect(issues(SEARCH, "remix")).toEqual(["(root): Expected object"]);
	});

	test("checks a nested object's properties by path", () => {
		let declared = withInput(
			s.object({ page: s.object({ size: s.integer().pipe(checks.max(50)) }) }),
		);

		expect(issues(declared, { page: { size: 500 } })).toEqual([
			"page.size: Expected number less than or equal to 50",
		]);
	});

	test("reports a refinement's own message", () => {
		let declared = withInput(
			s.object({
				slug: s.string().refine((slug) => !slug.includes(" "), "Use a slug, not a title"),
			}),
		);

		expect(issues(declared, { slug: "Remix V3" })).toEqual(["slug: Use a slug, not a title"]);
	});
});
