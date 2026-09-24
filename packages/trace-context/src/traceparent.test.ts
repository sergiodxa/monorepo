/**
 * Exercises the `traceparent` grammar: the specification's own example, every invalid form
 * the W3C test suite sends (wrong lengths, uppercase hex, version `ff`, all-zero ids), the
 * forward-compatible reading of a future version, and the flags byte in both directions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse, stringify, TraceParentParseError } from "./traceparent.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";

/** Parses a value the test expects to be refused, and answers with the code it was refused with. */
function codeOf(value: string): string {
	let result = parse(value);
	if (isSuccess(result)) throw new Error(`expected ${value} to be refused`);
	expect(result.error).toBeInstanceOf(TraceParentParseError);
	return result.error.code;
}

describe("parse", () => {
	test("reads the specification's example", () => {
		expect(unwrap(parse(`00-${TRACE_ID}-${PARENT_ID}-01`))).toEqual({
			version: 0,
			traceId: TRACE_ID,
			parentId: PARENT_ID,
			flags: 1,
			sampled: true,
			random: false,
		});
	});

	test("reads the Level 2 random-trace-id flag", () => {
		let value = unwrap(parse(`00-${TRACE_ID}-${PARENT_ID}-02`));
		expect(value).toMatchObject({ flags: 2, sampled: false, random: true });
	});

	test("keeps flag bits it does not define on read", () => {
		let value = unwrap(parse(`00-${TRACE_ID}-${PARENT_ID}-ff`));
		expect(value).toMatchObject({ flags: 0xff, sampled: true, random: true });
	});

	test("reads a future version by the version-00 rules, ignoring what follows", () => {
		expect(unwrap(parse(`cc-${TRACE_ID}-${PARENT_ID}-01-what-the-future-holds`))).toMatchObject({
			version: 0xcc,
			traceId: TRACE_ID,
			parentId: PARENT_ID,
			sampled: true,
		});
		expect(unwrap(parse(`01-${TRACE_ID}-${PARENT_ID}-01`)).version).toBe(1);
	});

	test.each([
		["", "empty"],
		[`00-${TRACE_ID}-${PARENT_ID}-01-`, "version 00 with trailing data"],
		[`00-${TRACE_ID}-${PARENT_ID}-01-extra`, "version 00 with trailing data"],
		[`cc-${TRACE_ID}-${PARENT_ID}-01.extra`, "future version with a non-dash separator"],
		[`00-${TRACE_ID.toUpperCase()}-${PARENT_ID}-01`, "uppercase trace id"],
		[`00-${TRACE_ID}-${PARENT_ID.toUpperCase()}-01`, "uppercase parent id"],
		[`0A-${TRACE_ID}-${PARENT_ID}-01`, "uppercase version"],
		[`00-${TRACE_ID}-${PARENT_ID}-0A`, "uppercase flags"],
		[`00-${TRACE_ID.slice(1)}-${PARENT_ID}-01`, "short trace id"],
		[`00-${TRACE_ID}0-${PARENT_ID}-01`, "long trace id"],
		[`00-${TRACE_ID}-${PARENT_ID.slice(1)}-01`, "short parent id"],
		[`00-${TRACE_ID}-${PARENT_ID}-1`, "short flags"],
		[`0-${TRACE_ID}-${PARENT_ID}-01`, "short version"],
		[`00_${TRACE_ID}_${PARENT_ID}_01`, "wrong separators"],
		[`00-${TRACE_ID.slice(0, -1)}g-${PARENT_ID}-01`, "non-hex trace id"],
		[` 00-${TRACE_ID}-${PARENT_ID}-01`, "leading space"],
	])("refuses %j as malformed (%s)", (value) => {
		expect(codeOf(value)).toBe("malformed");
	});

	test("refuses version ff", () => {
		expect(codeOf(`ff-${TRACE_ID}-${PARENT_ID}-01`)).toBe("invalid-version");
	});

	test("refuses an all-zero trace id", () => {
		expect(codeOf(`00-${"0".repeat(32)}-${PARENT_ID}-01`)).toBe("invalid-trace-id");
	});

	test("refuses an all-zero parent id", () => {
		expect(codeOf(`00-${TRACE_ID}-${"0".repeat(16)}-01`)).toBe("invalid-parent-id");
	});

	test("reports the failure as a Result, never a throw", () => {
		expect(isFailure(parse("nonsense"))).toBe(true);
	});
});

describe("stringify", () => {
	test("writes version 00 with the sampled flag", () => {
		expect(
			stringify({ traceId: TRACE_ID, parentId: PARENT_ID, sampled: true, random: false }),
		).toBe(`00-${TRACE_ID}-${PARENT_ID}-01`);
	});

	test("writes both defined flags and zeroes the rest", () => {
		let parsed = unwrap(parse(`00-${TRACE_ID}-${PARENT_ID}-ff`));
		expect(stringify(parsed)).toBe(`00-${TRACE_ID}-${PARENT_ID}-03`);
	});

	test("writes version 00 for a value read from a future version", () => {
		let parsed = unwrap(parse(`cc-${TRACE_ID}-${PARENT_ID}-00-more`));
		expect(stringify(parsed)).toBe(`00-${TRACE_ID}-${PARENT_ID}-00`);
	});

	test("round-trips through parse", () => {
		let written = stringify({
			traceId: TRACE_ID,
			parentId: PARENT_ID,
			sampled: false,
			random: true,
		});
		expect(unwrap(parse(written))).toMatchObject({ sampled: false, random: true, flags: 2 });
	});
});
