/**
 * Tests for the standard base64 codec.
 *
 * The padded standard alphabet is what receivers expect on the wire, and both
 * alphabets have to decode, so encoding is pinned to known values and decoding is
 * checked against the URL-safe form and against text that is neither.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { decodeBase64, encodeBase64 } from "./base64.js";

describe("encodeBase64", () => {
	test("emits the standard alphabet with padding", () => {
		expect(encodeBase64(new Uint8Array([251, 255]))).toBe("+/8=");
	});

	test("pads to a multiple of four", () => {
		expect(encodeBase64("h")).toBe("aA==");
		expect(encodeBase64("hi")).toBe("aGk=");
		expect(encodeBase64("hey")).toBe("aGV5");
	});

	test("encodes an empty payload as an empty string", () => {
		expect(encodeBase64(new Uint8Array())).toBe("");
	});
});

describe("decodeBase64", () => {
	test("decodes the standard alphabet", () => {
		expect([...unwrap(decodeBase64("+/8="))]).toEqual([251, 255]);
	});

	test("decodes the URL-safe alphabet to the same bytes", () => {
		expect([...unwrap(decodeBase64("-_8"))]).toEqual([251, 255]);
	});

	test("round-trips arbitrary bytes", () => {
		let bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);

		expect([...unwrap(decodeBase64(encodeBase64(bytes)))]).toEqual([...bytes]);
	});

	test("fails on text that is not base64", () => {
		expect(isFailure(decodeBase64("not base64!"))).toBe(true);
	});
});
