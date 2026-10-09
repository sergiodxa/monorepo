/**
 * Exercises the `tracestate` list: OWS and empty members, both key forms at their length
 * limits, value grammar, the 32-entry cap and duplicate keys, the move-left rule a vendor's
 * `set()` follows, and truncation dropping oversized entries before the rightmost ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse, stringify, TraceState, TraceStateParseError } from "./tracestate.js";

/** Parses a value the test expects to be refused, and answers with the code it was refused with. */
function codeOf(value: string): string {
	let result = parse(value);
	if (isSuccess(result)) throw new Error(`expected ${value} to be refused`);
	expect(result.error).toBeInstanceOf(TraceStateParseError);
	return result.error.code;
}

describe("parse", () => {
	test("reads the specification's example in order", () => {
		let state = unwrap(parse("rojo=00f067aa0ba902b7,congo=t61rcWkgMzE"));
		expect(state.size).toBe(2);
		expect([...state.entries()]).toEqual([
			["rojo", "00f067aa0ba902b7"],
			["congo", "t61rcWkgMzE"],
		]);
		expect(state.get("congo")).toBe("t61rcWkgMzE");
		expect(state.get("missing")).toBeUndefined();
	});

	test("trims optional whitespace around members and skips empty ones", () => {
		let state = unwrap(parse(" rojo=1 ,\t,, congo=2\t,"));
		expect([...state.entries()]).toEqual([
			["rojo", "1"],
			["congo", "2"],
		]);
	});

	test("trims long runs of optional whitespace in linear time", () => {
		let started = performance.now();
		let padding = "\t".repeat(50_000);
		let state = unwrap(parse(`${padding}rojo=1${padding},${padding},congo=2`));
		expect([...state.entries()]).toEqual([
			["rojo", "1"],
			["congo", "2"],
		]);
		expect(isSuccess(parse(`rojo=1${padding}x`))).toBe(false);
		expect(performance.now() - started).toBeLessThan(500);
	});

	test("reads an empty or whitespace-only header as the empty state", () => {
		expect(unwrap(parse("")).size).toBe(0);
		expect(unwrap(parse("  , ")).size).toBe(0);
	});

	test("accepts both key forms at their longest", () => {
		let simple = `a${"z".repeat(255)}`;
		let tenant = `${"1".repeat(241)}@${"s".repeat(14)}`;
		let state = unwrap(parse(`${simple}=1,${tenant}=2,a_-*/9=3,0tenant@sys=4`));
		expect(state.get(simple)).toBe("1");
		expect(state.get(tenant)).toBe("2");
		expect(state.get("0tenant@sys")).toBe("4");
	});

	test.each([
		[`a${"z".repeat(256)}=1`, "simple key over 256"],
		[`${"1".repeat(242)}@sys=1`, "tenant id over 241"],
		[`t@${"s".repeat(15)}=1`, "system id over 14"],
		["Rojo=1", "uppercase key"],
		["1rojo=1", "simple key starting with a digit"],
		["t@1sys=1", "system id starting with a digit"],
		["ro jo=1", "space inside a key"],
		["a@b@c=1", "two @"],
		["=1", "empty key"],
	])("refuses %j as an invalid key (%s)", (value) => {
		expect(codeOf(value)).toBe("invalid-key");
	});

	test.each([
		[`k=${"v".repeat(257)}`, "value over 256"],
		["k=", "empty value"],
		["k=a\u007fb", "control character"],
		["k=café", "non-ASCII"],
	])("refuses %j as an invalid value (%s)", (value) => {
		expect(codeOf(value)).toBe("invalid-value");
	});

	test("accepts a value of 256 printable characters with inner spaces", () => {
		let value = `${"v".repeat(127)} ${"v".repeat(128)}`;
		expect(unwrap(parse(`k=${value}`)).get("k")).toBe(value);
	});

	test("refuses a member with no = or with a second =", () => {
		expect(codeOf("rojo")).toBe("malformed");
		expect(codeOf("rojo=a=b")).toBe("malformed");
	});

	test("refuses a duplicate key", () => {
		expect(codeOf("rojo=1,congo=2,rojo=3")).toBe("duplicate-key");
	});

	test("accepts 32 entries and refuses 33", () => {
		let members = Array.from({ length: 33 }, (_, index) => `k${index}=v`);
		expect(unwrap(parse(members.slice(0, 32).join(","))).size).toBe(32);
		expect(codeOf(members.join(","))).toBe("too-many");
	});
});

describe("TraceState", () => {
	test("EMPTY has no entries", () => {
		expect(TraceState.EMPTY.size).toBe(0);
		expect([...TraceState.EMPTY.entries()]).toEqual([]);
	});

	test("set() puts a new key on the left", () => {
		let state = unwrap(unwrap(parse("rojo=1,congo=2")).set("blue", "3"));
		expect(stringify(state)).toBe("blue=3,rojo=1,congo=2");
	});

	test("set() moves an updated key to the left and leaves the original state as it was", () => {
		let original = unwrap(parse("rojo=1,congo=2"));
		let updated = unwrap(original.set("congo", "9"));
		expect(stringify(updated)).toBe("congo=9,rojo=1");
		expect(stringify(original)).toBe("rojo=1,congo=2");
	});

	test("set() refuses an invalid key or value", () => {
		let result = TraceState.EMPTY.set("Bad", "1");
		expect(isSuccess(result)).toBe(false);
		if (!isSuccess(result)) expect(result.error.code).toBe("invalid-key");

		let value = TraceState.EMPTY.set("good", "a,b");
		if (!isSuccess(value)) expect(value.error.code).toBe("invalid-value");
		else throw new Error("expected a refusal");
	});

	test("set() refuses a 33rd entry but accepts updating one of 32", () => {
		let state = unwrap(parse(Array.from({ length: 32 }, (_, index) => `k${index}=v`).join(",")));
		let added = state.set("extra", "v");
		if (!isSuccess(added)) expect(added.error.code).toBe("too-many");
		else throw new Error("expected a refusal");
		expect(unwrap(state.set("k31", "w")).size).toBe(32);
	});

	test("delete() drops a key and ignores a missing one", () => {
		let state = unwrap(parse("rojo=1,congo=2"));
		expect(stringify(state.delete("rojo"))).toBe("congo=2");
		expect(state.delete("missing")).toBe(state);
	});
});

describe("stringify", () => {
	test("writes the empty state as an empty string", () => {
		expect(stringify(TraceState.EMPTY)).toBe("");
	});

	test("leaves a list within the limit untouched", () => {
		let value = "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE";
		expect(stringify(unwrap(parse(value)))).toBe(value);
	});

	test("drops entries over 128 characters first, from the right", () => {
		let big = `big=${"b".repeat(140)}`;
		let bigger = `bigger=${"c".repeat(140)}`;
		let small = Array.from({ length: 4 }, (_, index) => `s${index}=${"v".repeat(40)}`);
		let state = unwrap(parse([big, ...small, bigger].join(",")));

		expect(stringify(state, { maxLength: 400 })).toBe([big, ...small].join(","));
		expect(stringify(state, { maxLength: 200 })).toBe(small.join(","));
	});

	test("drops the rightmost entries once none over 128 is left", () => {
		let state = unwrap(parse("a=1111,b=2222,c=3333"));
		expect(stringify(state, { maxLength: 13 })).toBe("a=1111,b=2222");
		expect(stringify(state, { maxLength: 5 })).toBe("");
	});

	test("truncates to 512 by default", () => {
		let members = Array.from({ length: 20 }, (_, index) => `k${index}=${"v".repeat(40)}`);
		let written = stringify(unwrap(parse(members.join(","))));
		expect(written.length).toBeLessThanOrEqual(512);
		expect(written).toBe(members.slice(0, 11).join(","));
	});
});
