/**
 * Tests for the reader: RFC 4180's grammar, the line endings and BOM real files carry,
 * the structural failures that stop a read, and the bare quote it keeps with a warning.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { CSVParseError } from "./lib/errors.js";
import { parse } from "./lib/parse.js";

/**
 * Reads records and fails the test on a parse failure.
 *
 * @param source - CSV text with a header record
 * @returns The records and warnings
 */
function records(source: string) {
	let result = parse(source);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * Reads rows without a header and fails the test on a parse failure.
 *
 * @param source - CSV text
 * @param delimiter - The field separator
 * @returns The rows
 */
function rows(source: string, delimiter: "," | ";" | "\t" = ",") {
	let result = parse(source, { header: false, delimiter });
	if (isFailure(result)) throw result.error;
	return result.data.rows;
}

/**
 * Reads text expected to fail and returns the error.
 *
 * @param source - CSV text
 * @returns The parse error
 */
function failureOf(source: string): CSVParseError {
	let result = parse(source);
	if (!isFailure(result)) throw new Error("expected a parse failure");
	return result.error;
}

describe("RFC 4180 section 2", () => {
	test("reads records separated by CRLF", () => {
		expect(rows("aaa,bbb,ccc\r\nzzz,yyy,xxx\r\n")).toEqual([
			["aaa", "bbb", "ccc"],
			["zzz", "yyy", "xxx"],
		]);
	});

	test("reads a last record without a line break", () => {
		expect(rows("aaa,bbb,ccc\r\nzzz,yyy,xxx")).toEqual([
			["aaa", "bbb", "ccc"],
			["zzz", "yyy", "xxx"],
		]);
	});

	test("reads the first record as keys", () => {
		expect(records("field_name,field_name2\r\naaa,bbb\r\n").rows).toEqual([
			{ field_name: "aaa", field_name2: "bbb" },
		]);
	});

	test("keeps spaces as part of a field", () => {
		expect(rows(" a , b ")).toEqual([[" a ", " b "]]);
	});

	test("reads quoted fields", () => {
		expect(rows('"aaa","bbb","ccc"')).toEqual([["aaa", "bbb", "ccc"]]);
	});

	test("reads line breaks, delimiters and doubled quotes inside quoted fields", () => {
		expect(rows('"aaa","b\r\nbb","c,cc"\r\n"a""b",x,y')).toEqual([
			["aaa", "b\r\nbb", "c,cc"],
			['a"b', "x", "y"],
		]);
	});

	test("reads empty fields, quoted and unquoted", () => {
		expect(rows('a,,""\r\n,,')).toEqual([
			["a", "", ""],
			["", "", ""],
		]);
	});
});

describe("files in the wild", () => {
	test("accepts LF and a lone CR as record endings", () => {
		expect(rows("a,b\nc,d\re,f")).toEqual([
			["a", "b"],
			["c", "d"],
			["e", "f"],
		]);
	});

	test("strips a UTF-8 BOM before the first header", () => {
		expect(records("﻿name,city\r\nAna,Málaga").rows).toEqual([{ name: "Ana", city: "Málaga" }]);
	});

	test("reads semicolon and tab delimited files", () => {
		expect(rows("a;b\r\n1,5;2", ";")).toEqual([
			["a", "b"],
			["1,5", "2"],
		]);
		expect(rows("a\tb\r\n1\t2", "\t")).toEqual([
			["a", "b"],
			["1", "2"],
		]);
	});

	test("skips blank lines", () => {
		expect(rows("a,b\r\n\r\nc,d\r\n\r\n")).toEqual([
			["a", "b"],
			["c", "d"],
		]);
	});

	test("keeps a bare quote inside an unquoted field and warns on its line", () => {
		let parsed = records('item,size\r\nscreen,5" wide');
		expect(parsed.rows).toEqual([{ item: "screen", size: '5" wide' }]);
		expect(parsed.warnings).toEqual([{ line: 2, message: expect.stringContaining("quote") }]);
	});

	test("reads an empty source as no records", () => {
		expect(records("").rows).toEqual([]);
		expect(rows("")).toEqual([]);
	});

	test("reads a header without records as no records", () => {
		expect(records("a,b\r\n").rows).toEqual([]);
	});

	test("defines __proto__ as an ordinary key", () => {
		let [row] = records("__proto__,name\r\nx,y").rows;
		expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
		expect(Object.keys(row!)).toEqual(["__proto__", "name"]);
	});
});

describe("structural failures", () => {
	test("fails on an unterminated quoted field, naming the line it opened on", () => {
		let error = failureOf('a,b\r\n1,"two\r\nthree');
		expect(error).toBeInstanceOf(CSVParseError);
		expect(error.line).toBe(2);
	});

	test("fails on a record whose field count differs from the header's", () => {
		let error = failureOf("a,b\r\n1,2\r\n3");
		expect(error.line).toBe(3);
	});

	test("fails on a field count mismatch without a header too", () => {
		let result = parse("a,b\r\n1", { header: false });
		expect(isFailure(result) && result.error.line).toBe(2);
	});

	test("fails on a duplicate header name", () => {
		let error = failureOf("id,name,id\r\n1,2,3");
		expect(error.line).toBe(1);
		expect(error.message).toContain("id");
	});

	test("fails on text after a closing quote", () => {
		let error = failureOf('a,b\r\n"one"two,3');
		expect(error.line).toBe(2);
	});

	test("counts lines inside quoted fields", () => {
		let error = failureOf('a,b\r\n"x\r\ny",1\r\n2');
		expect(error.line).toBe(4);
	});
});
