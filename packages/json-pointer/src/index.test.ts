/**
 * RFC 6901 examples for parse, stringify, get and set, plus the contracts the
 * callers rely on: empty pointers, invalid `~`, missing gets, and set that
 * leaves missing parents missing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { JsonPointerError, JsonPointerParseError, get, parse, set, stringify } from "./index.js";

/** The document RFC 6901 section 5 evaluates its example pointers against. */
const RFC_DOCUMENT = {
	foo: ["bar", "baz"],
	"": 0,
	"a/b": 1,
	"c%d": 2,
	"e^f": 3,
	"g|h": 4,
	"i\\j": 5,
	'k"l': 6,
	" ": 7,
	"m~n": 8,
};

describe("stringify", () => {
	test("writes the empty pointer for the root", () => {
		expect(stringify([])).toBe("");
	});

	test("escapes ~ as ~0 and / as ~1", () => {
		expect(stringify(["a/b", "m~n", 0])).toBe("/a~1b/m~0n/0");
	});

	test("writes an empty segment as a trailing slash", () => {
		expect(stringify([""])).toBe("/");
	});
});

describe("parse", () => {
	test("reads the empty pointer as the root", () => {
		expect(unwrap(parse(""))).toEqual([]);
	});

	test("unescapes ~1 then ~0 so ~01 becomes ~1", () => {
		expect(unwrap(parse("/a~1b/m~0n/~01"))).toEqual(["a/b", "m~n", "~1"]);
	});

	test("fails when the pointer does not start with /", () => {
		let result = parse("foo");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(JsonPointerParseError);
	});

	test("fails when a ~ is not followed by 0 or 1", () => {
		for (let pointer of ["/~", "/~2", "/foo/~x"]) {
			let result = parse(pointer);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(JsonPointerParseError);
		}
	});
});

describe("get", () => {
	test.each([
		["", RFC_DOCUMENT],
		["/foo", ["bar", "baz"]],
		["/foo/0", "bar"],
		["/", 0],
		["/a~1b", 1],
		["/c%d", 2],
		["/e^f", 3],
		["/g|h", 4],
		["/i\\j", 5],
		['/k"l', 6],
		["/ ", 7],
		["/m~0n", 8],
	] as const)("%s evaluates to the RFC example value", (pointer, value) => {
		expect(unwrap(get(RFC_DOCUMENT, pointer))).toEqual(value);
	});

	test("fails when a member is missing", () => {
		let result = get({ a: 1 }, "/b");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(JsonPointerError);
	});

	test("fails when an array index is out of range", () => {
		expect(isFailure(get({ foo: ["bar"] }, "/foo/1"))).toBe(true);
	});

	test("fails when a token walks through a scalar", () => {
		expect(isFailure(get({ a: 1 }, "/a/b"))).toBe(true);
	});

	test("fails when the pointer itself is invalid", () => {
		let result = get(RFC_DOCUMENT, "foo");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(JsonPointerParseError);
	});
});

describe("set", () => {
	test("replaces a member without mutating the original", () => {
		let document = { a: 1, b: { c: 2 } };
		let result = set(document, "/b/c", 3);
		expect(unwrap(result)).toEqual({ a: 1, b: { c: 3 } });
		expect(document).toEqual({ a: 1, b: { c: 2 } });
	});

	test("adds a member on an existing object", () => {
		expect(unwrap(set({ a: 1 }, "/b", 2))).toEqual({ a: 1, b: 2 });
	});

	test("replaces the document at the empty pointer", () => {
		expect(unwrap(set({ a: 1 }, "", { b: 2 }))).toEqual({ b: 2 });
	});

	test("fails when a parent is missing rather than creating it", () => {
		let result = set({}, "/a/b", 1);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(JsonPointerError);
			expect(result.error.message).toMatch(/missing parent/);
		}
	});

	test("fails when a parent is a scalar", () => {
		expect(isFailure(set({ a: 1 }, "/a/b", 2))).toBe(true);
	});

	test("fails when setting the root to a non-value", () => {
		let result = set({ a: 1 }, "", undefined);
		expect(isFailure(result)).toBe(true);
	});

	test("writes an escaped key as its unescaped member name", () => {
		expect(unwrap(set({}, "/a~1b", 1))).toEqual({ "a/b": 1 });
	});

	test("keeps a successful set as a new tree", () => {
		let result = set({ a: { b: 1 } }, "/a/b", 2);
		expect(isSuccess(result)).toBe(true);
	});
});
