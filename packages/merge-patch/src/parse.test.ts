/**
 * Covers reading and writing merge patch documents as text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { MergePatchParseError, parse, stringify } from "./parse.js";

describe("parse", () => {
	test("reads any JSON value as a patch", () => {
		expect(unwrap(parse('{"a":null,"b":[1]}'))).toEqual({ a: null, b: [1] });
		expect(unwrap(parse("null"))).toBeNull();
		expect(unwrap(parse('"x"'))).toBe("x");
	});

	test("fails on text that is not JSON", () => {
		let result = parse("{ nope");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MergePatchParseError);
	});
});

describe("stringify", () => {
	test("writes JSON text that parse reads back", () => {
		let patch = { a: null, b: { c: [1, "2"] } };
		expect(unwrap(parse(stringify(patch)))).toEqual(patch);
	});
});
