/**
 * Tests for the package's entry point: both halves reached the way callers reach
 * them, and the property that ties them together — writing a value and reading it
 * back returns the value it started from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import * as YAML from "./index";

/**
 * Writes a value and reads it back.
 *
 * @param value - The value to send through both halves
 * @returns The value that came back
 */
function roundTrip(value: unknown): unknown {
	let written = YAML.stringify(value);
	if (isFailure(written)) throw written.error;

	let read = YAML.parse(written.data);
	if (isFailure(read)) throw new Error(`${read.error.message}\n${written.data}`);

	return read.data;
}

describe("the package entry point", () => {
	test("reads and writes under a namespace import, the way JSON reads", () => {
		let written = YAML.stringify({ title: "Hello" });
		expect(isSuccess(written)).toBe(true);
		if (isFailure(written)) return;
		expect(written.data).toBe("title: Hello\n");

		let read = YAML.parse(written.data);
		expect(isSuccess(read)).toBe(true);
		if (isFailure(read)) return;
		expect(read.data).toEqual({ title: "Hello" });
	});

	test("reaches each half on its own, for a caller that only needs one", async () => {
		let { parse, stringify } = await import("./index");

		expect(isSuccess(parse("a: 1"))).toBe(true);
		expect(isSuccess(stringify({ a: 1 }))).toBe(true);
	});

	test("reports each half's failure with its own error type", () => {
		let parsed = YAML.parse("a: &anchor 1");
		expect(isFailure(parsed)).toBe(true);
		if (isFailure(parsed)) expect(parsed.error).toBeInstanceOf(YAML.YAMLParseError);

		let written = YAML.stringify(1n);
		expect(isFailure(written)).toBe(true);
		if (isFailure(written)) expect(written.error).toBeInstanceOf(YAML.YAMLStringifyError);
	});

	describe("round trip", () => {
		test.for([
			[
				"a document's frontmatter",
				{ title: "API Keys", section: { title: "Team & Settings", order: 3 } },
			],
			["every scalar type", { a: null, b: true, c: 1, d: -1.5, e: "text" }],
			["strings that look like other types", { a: "123", b: "yes", c: "2026-08-02", d: "~" }],
			["strings YAML reads as structure", { a: "x: y", b: "# c", c: "- d", d: "", e: " f " }],
			["a multi-line string", { body: "one\ntwo\n\nfour\n" }],
			["nested sequences and mappings", { a: [{ b: [1, 2] }, { c: { d: [] } }] }],
			["empty collections", { a: {}, b: [], c: [{}, []] }],
			["a sequence at the document root", [1, "two", null, { three: true }]],
			["a scalar at the document root", "just a string"],
			["keys needing quotes", { "a b": 1, "a: b": 2, "-": 3 }],
		])("survives %s", ([, value]) => {
			expect(roundTrip(value)).toEqual(value);
		});

		test("keeps the numbers JSON would lose", () => {
			let value = roundTrip({ a: Number.NaN, b: Number.POSITIVE_INFINITY }) as Record<
				string,
				number
			>;

			expect(value.a).toBeNaN();
			expect(value.b).toBe(Number.POSITIVE_INFINITY);
		});

		test("survives every indentation width the writer offers", () => {
			let value = { a: { b: [{ c: 1 }, "two"] } };

			for (let indent of [2, 3, 4, 8]) {
				let written = YAML.stringify(value, { indent });
				if (isFailure(written)) throw written.error;

				let read = YAML.parse(written.data);
				if (isFailure(read)) throw read.error;
				expect(read.data).toEqual(value);
			}
		});
	});
});
