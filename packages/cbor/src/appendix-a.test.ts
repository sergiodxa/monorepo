/**
 * The examples of encoded CBOR data items in RFC 8949 Appendix A, decoded, checked against
 * deterministic decoding, and re-encoded wherever the example is already deterministic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CBORValue } from "./index.js";

import { decode, encode, Simple, Tagged } from "./index.js";

/** One Appendix A example and how it behaves beyond plain decoding. */
interface Vector {
	hex: string;
	value: CBORValue;
	/** Whether `encode(value)` writes the same bytes back. */
	roundTrip: boolean;
	/** Whether the example meets deterministic encoding, so `deterministic: true` accepts it. */
	deterministic: boolean;
}

/** Bytes from a hex string. */
function bytes(hex: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

/** Hex from bytes. */
function hex(value: Uint8Array): string {
	return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** An example that re-encodes to itself. */
function exact(hexValue: string, value: CBORValue): Vector {
	return { hex: hexValue, value, roundTrip: true, deterministic: true };
}

/** A deterministic example whose JavaScript value encodes differently, as `1.0` becomes `1`. */
function lossy(hexValue: string, value: CBORValue): Vector {
	return { hex: hexValue, value, roundTrip: false, deterministic: true };
}

/** An example deterministic decoding refuses: an indefinite length or an over-wide float. */
function loose(hexValue: string, value: CBORValue): Vector {
	return { hex: hexValue, value, roundTrip: false, deterministic: false };
}

/** Integers 1 through 25, the longest array Appendix A writes out. */
const ONE_TO_25 = Array.from({ length: 25 }, (_, index) => index + 1);

/** Every example in RFC 8949 Appendix A, Table 6, in the order the RFC lists them. */
const VECTORS: Vector[] = [
	exact("00", 0),
	exact("01", 1),
	exact("0a", 10),
	exact("17", 23),
	exact("1818", 24),
	exact("1819", 25),
	exact("1864", 100),
	exact("1903e8", 1000),
	exact("1a000f4240", 1000000),
	exact("1b000000e8d4a51000", 1000000000000),
	exact("1bffffffffffffffff", 18446744073709551615n),
	exact("c249010000000000000000", 18446744073709551616n),
	exact("3bffffffffffffffff", -18446744073709551616n),
	exact("c349010000000000000000", -18446744073709551617n),
	exact("20", -1),
	exact("29", -10),
	exact("3863", -100),
	exact("3903e7", -1000),
	lossy("f90000", 0),
	exact("f98000", -0),
	lossy("f93c00", 1),
	exact("fb3ff199999999999a", 1.1),
	exact("f93e00", 1.5),
	lossy("f97bff", 65504),
	lossy("fa47c35000", 100000),
	exact("fa7f7fffff", 3.4028234663852886e38),
	exact("fb7e37e43c8800759c", 1e300),
	exact("f90001", 5.960464477539063e-8),
	exact("f90400", 0.00006103515625),
	lossy("f9c400", -4),
	exact("fbc010666666666666", -4.1),
	exact("f97c00", Infinity),
	exact("f97e00", Number.NaN),
	exact("f9fc00", -Infinity),
	loose("fa7f800000", Infinity),
	loose("fa7fc00000", Number.NaN),
	loose("faff800000", -Infinity),
	loose("fb7ff0000000000000", Infinity),
	loose("fb7ff8000000000000", Number.NaN),
	loose("fbfff0000000000000", -Infinity),
	exact("f4", false),
	exact("f5", true),
	exact("f6", null),
	exact("f7", undefined),
	exact("f0", new Simple(16)),
	exact("f8ff", new Simple(255)),
	exact("c074323031332d30332d32315432303a30343a30305a", new Tagged(0, "2013-03-21T20:04:00Z")),
	exact("c11a514b67b0", new Tagged(1, 1363896240)),
	exact("c1fb41d452d9ec200000", new Tagged(1, 1363896240.5)),
	exact("d74401020304", new Tagged(23, bytes("01020304"))),
	exact("d818456449455446", new Tagged(24, bytes("6449455446"))),
	exact(
		"d82076687474703a2f2f7777772e6578616d706c652e636f6d",
		new Tagged(32, "http://www.example.com"),
	),
	exact("40", bytes("")),
	exact("4401020304", bytes("01020304")),
	exact("60", ""),
	exact("6161", "a"),
	exact("6449455446", "IETF"),
	exact("62225c", '"\\'),
	exact("62c3bc", "ü"),
	exact("63e6b0b4", "水"),
	exact("64f0908591", "𐅑"),
	exact("80", []),
	exact("83010203", [1, 2, 3]),
	exact("8301820203820405", [1, [2, 3], [4, 5]]),
	exact("98190102030405060708090a0b0c0d0e0f101112131415161718181819", ONE_TO_25),
	exact("a0", new Map()),
	exact(
		"a201020304",
		new Map([
			[1, 2],
			[3, 4],
		]),
	),
	exact(
		"a26161016162820203",
		new Map<CBORValue, CBORValue>([
			["a", 1],
			["b", [2, 3]],
		]),
	),
	exact("826161a161626163", ["a", new Map([["b", "c"]])]),
	exact(
		"a56161614161626142616361436164614461656145",
		new Map([
			["a", "A"],
			["b", "B"],
			["c", "C"],
			["d", "D"],
			["e", "E"],
		]),
	),
	loose("5f42010243030405ff", bytes("0102030405")),
	loose("7f657374726561646d696e67ff", "streaming"),
	loose("9fff", []),
	loose("9f018202039f0405ffff", [1, [2, 3], [4, 5]]),
	loose("9f01820203820405ff", [1, [2, 3], [4, 5]]),
	loose("83018202039f0405ff", [1, [2, 3], [4, 5]]),
	loose("83019f0203ff820405", [1, [2, 3], [4, 5]]),
	loose("9f0102030405060708090a0b0c0d0e0f101112131415161718181819ff", ONE_TO_25),
	loose(
		"bf61610161629f0203ffff",
		new Map<CBORValue, CBORValue>([
			["a", 1],
			["b", [2, 3]],
		]),
	),
	loose("826161bf61626163ff", ["a", new Map([["b", "c"]])]),
	loose(
		"bf6346756ef563416d7421ff",
		new Map<CBORValue, CBORValue>([
			["Fun", true],
			["Amt", -2],
		]),
	),
];

describe("RFC 8949 Appendix A", () => {
	test.each(VECTORS)("decodes $hex", ({ hex: input, value }) => {
		let decoded = unwrap(decode(bytes(input)));
		if (typeof value === "number") expect(Object.is(decoded, value)).toBe(true);
		else expect(decoded).toEqual(value);
	});

	test.each(VECTORS.filter((vector) => vector.deterministic))(
		"accepts $hex as deterministic",
		({ hex: input }) => {
			expect(isFailure(decode(bytes(input), { deterministic: true }))).toBe(false);
		},
	);

	test.each(VECTORS.filter((vector) => !vector.deterministic))(
		"refuses $hex as not deterministic",
		({ hex: input }) => {
			let result = decode(bytes(input), { deterministic: true });
			expect(isFailure(result) && result.error.code).toBe("not-deterministic");
		},
	);

	test.each(VECTORS.filter((vector) => vector.roundTrip))(
		"encodes $hex",
		({ hex: input, value }) => {
			expect(hex(unwrap(encode(value)))).toBe(input);
		},
	);
});
