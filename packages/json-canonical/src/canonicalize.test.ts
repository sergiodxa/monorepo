/**
 * RFC 8785's own test vectors (the section 3.2 sample and its UTF-8 bytes, the sorting
 * sample and every Appendix B number) plus the I-JSON inputs JCS must refuse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { CanonicalJsonError, canonicalize } from "./canonicalize.js";

/** Section 3.2.2's input, as JSON text so the parser reads its number and escape spellings. */
const SECTION_3_2_2_INPUT = [
	"{",
	'  "numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],',
	'  "string": "\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/",',
	'  "literals": [null, true, false]',
	"}",
].join("\n");

/** Section 3.2.3's canonical form of that input. */
const SECTION_3_2_3_OUTPUT = String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`;

/** Section 3.2.4's UTF-8 bytes of that canonical form. */
const SECTION_3_2_4_HEX = `
	7b 22 6c 69 74 65 72 61 6c 73 22 3a 5b 6e 75 6c 6c 2c 74 72
	75 65 2c 66 61 6c 73 65 5d 2c 22 6e 75 6d 62 65 72 73 22 3a
	5b 33 33 33 33 33 33 33 33 33 2e 33 33 33 33 33 33 33 2c 31
	65 2b 33 30 2c 34 2e 35 2c 30 2e 30 30 32 2c 31 65 2d 32 37
	5d 2c 22 73 74 72 69 6e 67 22 3a 22 e2 82 ac 24 5c 75 30 30
	30 66 5c 6e 41 27 42 5c 22 5c 5c 5c 5c 5c 22 2f 22 7d`;

/** Appendix B: IEEE 754 bit patterns and their serialization. */
const APPENDIX_B: [string, string][] = [
	["0000000000000000", "0"],
	["8000000000000000", "0"],
	["0000000000000001", "5e-324"],
	["8000000000000001", "-5e-324"],
	["7fefffffffffffff", "1.7976931348623157e+308"],
	["ffefffffffffffff", "-1.7976931348623157e+308"],
	["4340000000000000", "9007199254740992"],
	["c340000000000000", "-9007199254740992"],
	["4430000000000000", "295147905179352830000"],
	["44b52d02c7e14af5", "9.999999999999997e+22"],
	["44b52d02c7e14af6", "1e+23"],
	["44b52d02c7e14af7", "1.0000000000000001e+23"],
	["444b1ae4d6e2ef4e", "999999999999999700000"],
	["444b1ae4d6e2ef4f", "999999999999999900000"],
	["444b1ae4d6e2ef50", "1e+21"],
	["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
	["3eb0c6f7a0b5ed8d", "0.000001"],
	["41b3de4355555553", "333333333.3333332"],
	["41b3de4355555554", "333333333.33333325"],
	["41b3de4355555555", "333333333.3333333"],
	["41b3de4355555556", "333333333.3333334"],
	["41b3de4355555557", "333333333.33333343"],
	["becbf647612f3696", "-0.0000033333333333333333"],
	["43143ff3c1cb0959", "1424953923781206.2"],
];

/** The double whose big-endian bit pattern is `hex`. */
function fromBits(hex: string): number {
	let view = new DataView(new ArrayBuffer(8));
	view.setBigUint64(0, BigInt(`0x${hex}`));
	return view.getFloat64(0);
}

/** The error `canonicalize` returned, or a test failure when it succeeded. */
function refusal(value: unknown): CanonicalJsonError {
	let result = canonicalize(value);
	if (!isFailure(result)) throw new Error("expected canonicalize to fail");
	return result.error;
}

describe("canonicalize", () => {
	test("writes the section 3.2.3 canonical form of the section 3.2.2 sample", () => {
		expect(unwrap(canonicalize(JSON.parse(SECTION_3_2_2_INPUT)))).toBe(SECTION_3_2_3_OUTPUT);
	});

	test("encodes to the section 3.2.4 UTF-8 bytes", () => {
		let text = unwrap(canonicalize(JSON.parse(SECTION_3_2_2_INPUT)));
		let hex = Array.from(new TextEncoder().encode(text), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join(" ");
		expect(hex).toBe(SECTION_3_2_4_HEX.trim().split(/\s+/u).join(" "));
	});

	test("sorts the section 3.2.3 property names by UTF-16 code units", () => {
		let input = Object.fromEntries(
			[
				[[0x20ac], "Euro Sign"],
				[[0x0d], "Carriage Return"],
				[[0xfb33], "Hebrew Letter Dalet With Dagesh"],
				[[0x31], "One"],
				[[0xd83d, 0xde00], "Emoji: Grinning Face"],
				[[0x80], "Control"],
				[[0xf6], "Latin Small Letter O With Diaeresis"],
			].map(([units, value]) => [String.fromCharCode(...(units as number[])), value as string]),
		);
		let written = unwrap(canonicalize(input));
		let positions = Object.values(input).map((value) => [value, written.indexOf(value)] as const);

		expect(positions.sort((a, b) => a[1] - b[1]).map(([value]) => value)).toEqual([
			"Carriage Return",
			"One",
			"Control",
			"Latin Small Letter O With Diaeresis",
			"Euro Sign",
			"Emoji: Grinning Face",
			"Hebrew Letter Dalet With Dagesh",
		]);
	});

	test.each(APPENDIX_B)("serializes the Appendix B number %s as %s", (bits, expected) => {
		expect(unwrap(canonicalize(fromBits(bits)))).toBe(expected);
	});

	test("sorts nested objects and keeps array order", () => {
		expect(unwrap(canonicalize({ b: [{ z: 1, a: 2 }, 3], a: { d: true, c: null } }))).toBe(
			'{"a":{"c":null,"d":true},"b":[{"a":2,"z":1},3]}',
		);
	});

	test("escapes control characters in lowercase hex and keeps other text as is", () => {
		let input = String.fromCharCode(
			0x00,
			0x1f,
			0x08,
			0x09,
			0x0a,
			0x0c,
			0x0d,
			0x22,
			0x5c,
			0x2f,
			0xe9,
		);
		let escaped = ["u0000", "u001f", "b", "t", "n", "f", "r", '"', "\\"].map((e) => `\\${e}`);
		expect(unwrap(canonicalize(input))).toBe(`"${escaped.join("")}/${String.fromCharCode(0xe9)}"`);
	});

	test.each([
		["NaN", NaN, ""],
		["Infinity", { a: [Infinity] }, "/a/0"],
		["a lone surrogate", ["\udead"], "/0"],
		["a lone surrogate in a member name", { "\ud800": 1 }, "/\ud800"],
		["undefined", { a: undefined }, "/a"],
		["a sparse array hole", Object.assign([] as number[], { length: 2 }), "/0"],
		["a bigint", 1n, ""],
		["a function", { f: () => 1 }, "/f"],
		["a Date", { at: new Date(0) }, "/at"],
		["a Map", new Map(), ""],
	])("refuses %s", (_label, value, pointer) => {
		let error = refusal(value);
		expect(error).toBeInstanceOf(CanonicalJsonError);
		expect(error.pointer).toBe(pointer);
	});

	test("refuses a cycle", () => {
		let value: Record<string, unknown> = { a: [] };
		(value.a as unknown[]).push(value);
		expect(refusal(value).pointer).toBe("/a/0");
	});

	test("writes the same value twice when it is shared rather than cyclic", () => {
		let shared = { x: 1 };
		expect(unwrap(canonicalize([shared, shared]))).toBe('[{"x":1},{"x":1}]');
	});

	test("accepts an object without a prototype", () => {
		let value = Object.assign(Object.create(null) as Record<string, number>, { b: 1, a: 2 });
		expect(unwrap(canonicalize(value))).toBe('{"a":2,"b":1}');
	});
});
