import { Location } from "@sdxc/location";
/**
 * Tests for the reader: the bracket syntax it nests, the sources it accepts, the limits that
 * fail a query, and the schema that types the result.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { ParseOptions } from "./index.js";

import { parse } from "./index.js";

/** Accepts any value, so a test observes the nested value exactly as the reader built it. */
const ANY = s.any();

/**
 * Reads a query with a schema that accepts anything, failing the test on a parse failure.
 *
 * @param query - The query string
 * @param options - Reader limits
 * @returns The nested value
 */
function read(query: string, options?: ParseOptions): unknown {
	let result = parse(query, ANY, options);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * Reads a query expected to fail and returns the failure's issues.
 *
 * @param query - The query string
 * @param options - Reader limits
 * @returns The issues of the failure
 */
function issues(query: string, options?: ParseOptions) {
	let result = parse(query, ANY, options);
	if (isSuccess(result)) throw new Error(`Expected "${query}" to fail`);
	expect(result.error).toBeInstanceOf(ValidationError);
	return result.error.issues;
}

describe("nesting", () => {
	test.each([
		["a=1", { a: "1" }],
		["a=1&a=2", { a: ["1", "2"] }],
		["a[b][c]=1", { a: { b: { c: "1" } } }],
		["a[]=1&a[]=2", { a: ["1", "2"] }],
		["a[]=1", { a: ["1"] }],
		["a[1]=y&a[0]=x", { a: ["x", "y"] }],
		["a[0]=x&a[]=y", { a: ["x", "y"] }],
		["a[5]=x", { a: ["x"] }],
		["a[0][b]=1&a[0][c]=2&a[1][b]=3", { a: [{ b: "1", c: "2" }, { b: "3" }] }],
		["a[0]=x&a[k]=y", { a: { 0: "x", k: "y" } }],
		["a[01]=x", { a: { "01": "x" } }],
		["a[b]=1&a[b]=2", { a: { b: ["1", "2"] } }],
		["0=x&1=y", { 0: "x", 1: "y" }],
		["a[b=1", { "a[b": "1" }],
		["[a]=1", { "[a]": "1" }],
		["a]=1", { "a]": "1" }],
		["a[b]c=1", { "a[b]c": "1" }],
		["=1", { "": "1" }],
		["a=", { a: "" }],
		["", {}],
	])("%s", (query, expected) => {
		expect(read(query)).toEqual(expected);
	});

	test("decodes keys and values before reading brackets", () => {
		expect(read("a%5Bb%5D=hello+world&c=%C3%A9")).toEqual({ a: { b: "hello world" }, c: "é" });
	});

	test("stores a large index as one entry", () => {
		expect(read("a[99999999]=x")).toEqual({ a: ["x"] });
	});

	test("ignores a parameter naming __proto__", () => {
		let value = read("__proto__[polluted]=1&a[__proto__][polluted]=1&b=2");
		expect(value).toEqual({ b: "2" });
		expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
	});

	test("fails when a key is both a value and a group", () => {
		expect(issues("a=1&a[b]=2")).toEqual([
			expect.objectContaining({ path: ["a"], message: expect.stringContaining("a[b]") }),
		]);
		expect(issues("a[b][c]=1&a[b]=2")).toEqual([expect.objectContaining({ path: ["a", "b"] })]);
	});
});

describe("sources", () => {
	let expected = { a: { b: "1" } };

	test("reads a string with or without the leading ?", () => {
		expect(read("?a[b]=1")).toEqual(expected);
		expect(read("a[b]=1")).toEqual(expected);
	});

	test("reads URLSearchParams", () => {
		expect(parse(new URLSearchParams("a[b]=1"), ANY)).toEqual({
			status: "success",
			data: expected,
		});
	});

	test("reads a URL and a Location through their searchParams", () => {
		let url = new URL("https://example.com/list?a[b]=1#top");
		expect(parse(url, ANY)).toEqual({ status: "success", data: expected });

		let location = new Location({ pathname: "/list", search: "a[b]=1", hash: "top" });
		expect(parse(location, ANY)).toEqual({ status: "success", data: expected });
	});

	test("reads FormData, keeping files as values", () => {
		let photo = new File(["x"], "photo.png", { type: "image/png" });
		let form = new FormData();
		form.append("post[title]", "Hi");
		form.append("post[photos][]", photo);
		form.append("post[photos][]", photo);

		let result = parse(
			form,
			s.object({
				post: s.object({ title: s.string(), photos: s.array(s.instanceof_(File)) }),
			}),
		);
		if (isFailure(result)) throw result.error;
		expect(result.data.post.title).toBe("Hi");
		expect(result.data.post.photos).toHaveLength(2);
		expect(result.data.post.photos[0]?.name).toBe("photo.png");
	});
});

describe("limits", () => {
	test("fails a key deeper than depth", () => {
		expect(read("a[b][c][d][e][f]=1")).toEqual({ a: { b: { c: { d: { e: { f: "1" } } } } } });
		expect(issues("a[b][c][d][e][f][g]=1")).toEqual([
			expect.objectContaining({ path: ["a[b][c][d][e][f][g]"] }),
		]);
		expect(issues("a[b][c]=1", { depth: 1 })).toHaveLength(1);
	});

	test("fails a query with more parameters than parameterLimit", () => {
		expect(read("a=1&b=2", { parameterLimit: 2 })).toEqual({ a: "1", b: "2" });
		expect(issues("a=1&b=2&c=3", { parameterLimit: 2 })).toHaveLength(1);
	});
});

describe("schema", () => {
	let Filters = s.object({
		filter: s.object({ status: s.string(), tags: s.array(s.string()) }),
		page: coerce.number(),
	});

	test("types the value by the schema's output", () => {
		let result = parse("filter[status]=open&filter[tags][]=a&page=2", Filters);
		expect(result).toEqual({
			status: "success",
			data: { filter: { status: "open", tags: ["a"] }, page: 2 },
		});
		if (isSuccess(result)) {
			expectTypeOf(result.data).toEqualTypeOf<{
				filter: { status: string; tags: string[] };
				page: number;
			}>();
		}
	});

	test("carries the schema's issues with their paths", () => {
		let result = parse("filter[status]=open&page=two", Filters);
		if (isSuccess(result)) throw new Error("Expected a failure");
		let paths = result.error.issues.map((issue) => issue.path);
		expect(paths).toContainEqual(["filter", "tags"]);
		expect(paths).toContainEqual(["page"]);
	});

	test("fails with an asynchronous schema", () => {
		let schema = {
			"~standard": {
				version: 1,
				vendor: "test",
				validate: async (value: unknown) => ({ value }),
			},
		} as const;
		let result = parse("a=1", schema);
		if (isSuccess(result)) throw new Error("Expected a failure");
		expect(result.error.issues).toHaveLength(1);
	});
});
