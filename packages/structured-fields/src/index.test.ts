/**
 * Tests for the entry point beyond the httpwg suite: the shorthand input forms, the paths a
 * stringify failure reports, the typed `parse` overload, and the `Headers` helpers reading
 * an absent field and deleting an empty one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	Decimal,
	DisplayString,
	getField,
	parse,
	setField,
	stringify,
	StructuredFieldParseError,
	StructuredFieldStringifyError,
	Token,
	ValidationError,
} from "./index.js";

describe("parse", () => {
	test("keeps Token, String, Decimal and Display String apart", () => {
		let parsed = parse('HIT, "HIT", 1.0, 1, %"f%c3%bc"', "list");
		if (isFailure(parsed)) throw parsed.error;
		let values = parsed.data.map((member) => ("value" in member ? member.value : null));
		expect(values).toStrictEqual([
			new Token("HIT"),
			"HIT",
			new Decimal(1),
			1,
			new DisplayString("fü"),
		]);
	});

	test("gives Dictionaries and Parameters a null prototype in field order", () => {
		let parsed = parse("b=1;y;x=2, a, b=3", "dictionary");
		if (isFailure(parsed)) throw parsed.error;
		expect(Object.getPrototypeOf(parsed.data)).toBeNull();
		expect(Object.keys(parsed.data)).toEqual(["b", "a"]);
		expect(parsed.data.b).toEqual({ value: 3, params: {} });
		let first = parse("1;y;x=2", "item");
		if (isFailure(first)) throw first.error;
		expect(Object.getPrototypeOf(first.data.params)).toBeNull();
		expect(Object.keys(first.data.params)).toEqual(["y", "x"]);
	});

	test("reports where the text stops being valid", () => {
		let parsed = parse("1, 2,", "list");
		expect(isFailure(parsed)).toBe(true);
		if (isSuccess(parsed)) return;
		expect(parsed.error).toBeInstanceOf(StructuredFieldParseError);
		expect(parsed.error.name).toBe("StructuredFieldParseError");
		expect(parsed.error.position).toBe(5);
	});

	test("reads the same text as whichever type the caller names", () => {
		let asItem = parse("value=1", "item");
		expect(isFailure(asItem)).toBe(true);
		let asDictionary = parse("value=1", "dictionary");
		expect(isSuccess(asDictionary)).toBe(true);
	});

	test("fails a field value carrying non-ASCII text", () => {
		expect(isFailure(parse('"fü"', "item"))).toBe(true);
	});

	test("validates the model against a schema and returns its output", () => {
		let schema = s.object({ a: s.object({ value: s.number(), params: s.object({}) }) });
		let parsed = parse("a=5", "dictionary", schema);
		if (isFailure(parsed)) throw parsed.error;
		expect(parsed.data).toEqual({ a: { value: 5, params: {} } });
	});

	test("fails with ValidationError when the model does not fit the schema", () => {
		let schema = s.object({ a: s.object({ value: s.string() }) });
		let parsed = parse("a=5", "dictionary", schema);
		expect(isFailure(parsed)).toBe(true);
		if (isSuccess(parsed)) return;
		expect(parsed.error).toBeInstanceOf(ValidationError);
		if (!(parsed.error instanceof ValidationError)) return;
		expect(parsed.error.issues[0]?.path).toEqual(["a", "value"]);
	});

	test("fails with the parse error before the schema runs", () => {
		let parsed = parse("a=", "dictionary", s.any());
		expect(isFailure(parsed) && parsed.error).toBeInstanceOf(StructuredFieldParseError);
	});

	test("rejects a schema that may answer asynchronously at the type level", () => {
		let maybeAsync = s.any() as StandardSchemaV1<unknown, unknown>;
		// @ts-expect-error -- parse accepts only schemas whose validate answers synchronously
		expect(isSuccess(parse("1", "item", maybeAsync))).toBe(true);
	});

	test("fails a schema that answers asynchronously", () => {
		let asyncSchema = {
			"~standard": {
				version: 1,
				vendor: "test",
				validate: async (value: unknown) => ({ value }),
			},
		} as unknown as StandardSchemaV1<unknown, unknown> & {
			"~standard": { validate(value: unknown): StandardSchemaV1.Result<unknown> };
		};
		let parsed = parse("1", "item", asyncSchema);
		expect(isFailure(parsed) && parsed.error).toBeInstanceOf(ValidationError);
	});
});

describe("stringify", () => {
	test("writes a plain number as an Integer or Decimal, and new Decimal(1) as 1.0", () => {
		expect(stringify([1, 1.5, new Decimal(1)], "list")).toEqual({
			status: "success",
			data: "1, 1.5, 1.0",
		});
	});

	test("accepts members bare, with parameters, and as Inner Lists of either", () => {
		let written = stringify(
			[
				new Token("a"),
				{ value: "b", params: { q: new Decimal(0.5) } },
				{ items: [1, { value: 2, params: { x: true } }], params: { lvl: 1 } },
			],
			"list",
		);
		expect(isSuccess(written) && written.data).toBe('a, "b";q=0.5, (1 2;x);lvl=1');
	});

	test("writes a true Dictionary member or parameter as the bare key", () => {
		let written = stringify({ i: true, u: { value: true, params: { p: true } } }, "dictionary");
		expect(isSuccess(written) && written.data).toBe("i, u;p");
	});

	test("writes an Item-shaped Dictionary as a Dictionary", () => {
		let written = stringify({ value: 1, params: 2 }, "dictionary");
		expect(isSuccess(written) && written.data).toBe("value=1, params=2");
	});

	test("quotes and escapes a string", () => {
		let written = stringify('say "hi" \\o/', "item");
		expect(isSuccess(written) && written.data).toBe('"say \\"hi\\" \\\\o/"');
	});

	test("writes an empty List or Dictionary as the empty string", () => {
		expect(stringify([], "list")).toEqual({ status: "success", data: "" });
		expect(stringify({}, "dictionary")).toEqual({ status: "success", data: "" });
	});

	test("writes whole-second Dates and fails a Date carrying milliseconds", () => {
		let written = stringify(new Date(1_659_578_233_000), "item");
		expect(isSuccess(written) && written.data).toBe("@1659578233");
		expect(isFailure(stringify(new Date(1_659_578_233_500), "item"))).toBe(true);
	});

	test("fails an unpaired surrogate in a Display String", () => {
		expect(isFailure(stringify(new DisplayString("\uD800"), "item"))).toBe(true);
	});

	test.each([
		["an out-of-range Integer in a list", [1, 1e15], "list", [1]],
		["a non-ASCII string parameter", { value: 1, params: { a: "fü" } }, "item", ["params", "a"]],
		["an invalid key", { Upper: 1 }, "dictionary", ["Upper"]],
		[
			"an invalid Token inside an Inner List",
			[{ items: [new Token("1a")] }],
			"list",
			[0, "items", 0],
		],
		["a value that is no bare item", { value: null }, "item", ["value"]],
	] as const)("reports the path to %s", (_name, value, type, path) => {
		let written = stringify(value as never, type);
		expect(isFailure(written)).toBe(true);
		if (isSuccess(written)) return;
		expect(written.error).toBeInstanceOf(StructuredFieldStringifyError);
		expect(written.error.name).toBe("StructuredFieldStringifyError");
		expect(written.error.path).toEqual(path);
	});
});

describe("getField", () => {
	test("succeeds with null when the field is absent", () => {
		expect(getField(new Headers(), "Priority", "dictionary")).toEqual({
			status: "success",
			data: null,
		});
		expect(getField(new Headers(), "Priority", "dictionary", s.any())).toEqual({
			status: "success",
			data: null,
		});
	});

	test("reads repeated field lines as one combined value", () => {
		let headers = new Headers();
		headers.append("Example-List", "1");
		headers.append("Example-List", "2");
		let read = getField(headers, "Example-List", "list");
		if (isFailure(read)) throw read.error;
		expect(read.data).toHaveLength(2);
	});

	test("validates through the schema overload", () => {
		let headers = new Headers({ "Example-Item": '"key"' });
		let read = getField(headers, "Example-Item", "item", s.object({ value: s.string() }));
		if (isFailure(read)) throw read.error;
		expect(read.data).toEqual({ value: "key" });
	});

	test("fails an invalid field", () => {
		let read = getField(new Headers({ "Example-Item": "(" }), "Example-Item", "item");
		expect(isFailure(read) && read.error).toBeInstanceOf(StructuredFieldParseError);
	});
});

describe("setField", () => {
	test("writes the canonical text", () => {
		let headers = new Headers();
		expect(
			isSuccess(setField(headers, "RateLimit", { limit: 10, remaining: 0 }, "dictionary")),
		).toBe(true);
		expect(headers.get("RateLimit")).toBe("limit=10, remaining=0");
	});

	test("deletes the field when the List or Dictionary is empty", () => {
		let headers = new Headers({ RateLimit: "limit=10" });
		expect(isSuccess(setField(headers, "RateLimit", {}, "dictionary"))).toBe(true);
		expect(headers.has("RateLimit")).toBe(false);
	});

	test("leaves the headers untouched when the value has no representation", () => {
		let headers = new Headers({ RateLimit: "limit=10" });
		expect(isFailure(setField(headers, "RateLimit", { limit: 1e16 }, "dictionary"))).toBe(true);
		expect(headers.get("RateLimit")).toBe("limit=10");
	});
});
