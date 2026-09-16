/**
 * Tests for the byte conversion helpers.
 *
 * Concatenation builds the `info` strings and framed records other protocols read
 * byte by byte, so these pin the boundaries: text parts land as UTF-8, empty parts
 * take no room, and nothing is dropped at a seam.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { concatBytes } from "./bytes.js";

describe("concatBytes", () => {
	test("joins byte runs in the order they are given", () => {
		let joined = concatBytes(Uint8Array.of(1, 2), Uint8Array.of(3), Uint8Array.of(4, 5));

		expect(joined).toEqual(Uint8Array.of(1, 2, 3, 4, 5));
	});

	test("reads a text part as its UTF-8 bytes", () => {
		expect(concatBytes("hi", Uint8Array.of(0))).toEqual(Uint8Array.of(0x68, 0x69, 0));
		expect(concatBytes("é")).toEqual(Uint8Array.of(0xc3, 0xa9));
	});

	test("accepts an ArrayBuffer part", () => {
		expect(concatBytes(Uint8Array.of(1, 2).buffer, Uint8Array.of(3))).toEqual(
			Uint8Array.of(1, 2, 3),
		);
	});

	test("ignores parts carrying no bytes", () => {
		expect(concatBytes(Uint8Array.of(1), new Uint8Array(0), "", Uint8Array.of(2))).toEqual(
			Uint8Array.of(1, 2),
		);
	});

	test("returns an empty buffer when given nothing", () => {
		expect(concatBytes()).toEqual(new Uint8Array(0));
	});

	test("copies each part, leaving the sources untouched", () => {
		let part = Uint8Array.of(1, 2);
		let joined = concatBytes(part, Uint8Array.of(3));

		joined[0] = 9;

		expect(part).toEqual(Uint8Array.of(1, 2));
	});
});
