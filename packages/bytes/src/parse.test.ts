/**
 * Tests for the runtime parser: that it accepts exactly the forms the byte size
 * string type allows plus a bare amount of bytes, keeps decimal and binary units
 * apart, and reports everything else as a failure naming the rejected text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { InvalidByteSizeError } from "./invalid-byte-size-error.js";
import { parse } from "./parse.js";

describe("parse", () => {
	test("reads decimal symbols in powers of 1000", () => {
		expect(unwrap(parse("1 B"))).toBe(1);
		expect(unwrap(parse("1 kB"))).toBe(1000);
		expect(unwrap(parse("10 MB"))).toBe(10_000_000);
		expect(unwrap(parse("2 GB"))).toBe(2_000_000_000);
		expect(unwrap(parse("1 TB"))).toBe(1e12);
		expect(unwrap(parse("1 PB"))).toBe(1e15);
	});

	test("reads binary symbols in powers of 1024", () => {
		expect(unwrap(parse("1 KiB"))).toBe(1024);
		expect(unwrap(parse("10 MiB"))).toBe(10 * 1024 * 1024);
		expect(unwrap(parse("2 GiB"))).toBe(2 * 1024 ** 3);
		expect(unwrap(parse("1 TiB"))).toBe(1024 ** 4);
		expect(unwrap(parse("1 PiB"))).toBe(1024 ** 5);
	});

	test("takes a symbol with or without a space", () => {
		expect(unwrap(parse("10MB"))).toBe(unwrap(parse("10 MB")));
		expect(unwrap(parse("10MiB"))).toBe(unwrap(parse("10 MiB")));
		expect(unwrap(parse("512B"))).toBe(512);
	});

	test("reads long names after a single space", () => {
		expect(unwrap(parse("1 byte"))).toBe(1);
		expect(unwrap(parse("64 bytes"))).toBe(64);
		expect(unwrap(parse("1 kilobyte"))).toBe(1000);
		expect(unwrap(parse("10 megabytes"))).toBe(10_000_000);
		expect(unwrap(parse("1 gigabyte"))).toBe(1e9);
		expect(unwrap(parse("1 kibibyte"))).toBe(1024);
		expect(unwrap(parse("10 mebibytes"))).toBe(10 * 1024 * 1024);
		expect(unwrap(parse("1 gibibyte"))).toBe(1024 ** 3);
	});

	test("reads a bare amount as bytes", () => {
		expect(unwrap(parse("0"))).toBe(0);
		expect(unwrap(parse("1048576"))).toBe(1_048_576);
	});

	test("trims surrounding whitespace", () => {
		expect(unwrap(parse("  10 MiB\n"))).toBe(10_485_760);
	});

	test("accepts zero and negative amounts", () => {
		expect(unwrap(parse("0 GB"))).toBe(0);
		expect(unwrap(parse("-1 KiB"))).toBe(-1024);
	});

	test.each([
		["", "empty text"],
		["MB", "a unit with no amount"],
		["10 KB", "the ambiguous KB"],
		["10 mb", "a lowercase symbol"],
		["10 Mb", "megabits"],
		["10 mib", "a lowercase binary symbol"],
		["10megabytes", "a long name without its space"],
		["10  MB", "two spaces"],
		["1.5 GB", "a fraction"],
		["5e3 B", "an exponent"],
		["05 MB", "a leading zero"],
		["+5 MB", "a plus sign"],
		["10 Megabytes", "a capitalized name"],
		["1 MB 512 kB", "a compound size"],
		["10 EB", "an unsupported unit"],
		["10 toString", "an inherited property name"],
	])("rejects %j (%s)", (text) => {
		let result = parse(text);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(InvalidByteSizeError);
			expect(result.error.text).toBe(text);
		}
	});

	test("rejects a size beyond the largest exact integer", () => {
		expect(unwrap(parse("7 PiB"))).toBe(7 * 1024 ** 5);
		expect(isFailure(parse("8 PiB"))).toBe(true);
		expect(isFailure(parse("9007199254740993"))).toBe(true);
	});

	test("quotes the rejected text in the error message", () => {
		let result = parse("10 KB");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.message).toBe('Invalid byte size: "10 KB"');
	});
});
