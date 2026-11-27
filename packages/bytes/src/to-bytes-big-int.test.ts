/**
 * Tests for the bigint conversion and parser: exact results past the number
 * range, the exa-through-yotta units, the shared grammar's rejections, and the
 * typed throw when text bypasses the size type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { BigByteSizeInput, BigByteSizeString } from "./types.js";

import { InvalidByteSizeError } from "./invalid-byte-size-error.js";
import { parseBigInt } from "./parse.js";
import { toBytesBigInt } from "./to-bytes-big-int.js";

describe("parseBigInt", () => {
	test("reads every unit a number-based size accepts", () => {
		expect(unwrap(parseBigInt("10 MiB"))).toBe(10_485_760n);
		expect(unwrap(parseBigInt("10MB"))).toBe(10_000_000n);
		expect(unwrap(parseBigInt("4 kibibytes"))).toBe(4096n);
		expect(unwrap(parseBigInt("1048576"))).toBe(1_048_576n);
	});

	test("reads exa through yotta in powers of 1000", () => {
		expect(unwrap(parseBigInt("1 EB"))).toBe(10n ** 18n);
		expect(unwrap(parseBigInt("1 ZB"))).toBe(10n ** 21n);
		expect(unwrap(parseBigInt("1 YB"))).toBe(10n ** 24n);
		expect(unwrap(parseBigInt("2 exabytes"))).toBe(2n * 10n ** 18n);
	});

	test("reads exbi through yobi in powers of 1024", () => {
		expect(unwrap(parseBigInt("1 EiB"))).toBe(2n ** 60n);
		expect(unwrap(parseBigInt("1 ZiB"))).toBe(2n ** 70n);
		expect(unwrap(parseBigInt("1 YiB"))).toBe(2n ** 80n);
		expect(unwrap(parseBigInt("3 yobibytes"))).toBe(3n * 2n ** 80n);
	});

	test("stays exact where a number would round", () => {
		expect(unwrap(parseBigInt("8 PiB"))).toBe(8n * 2n ** 50n);
		expect(unwrap(parseBigInt("9007199254740993"))).toBe(9_007_199_254_740_993n);
		expect(unwrap(parseBigInt("1000000 YB"))).toBe(10n ** 30n);
	});

	test.each(["", "10 KB", "10 eb", "1.5 EB", "10exabytes", "1 RB", "10 toString"])(
		"rejects %j",
		(text) => {
			let result = parseBigInt(text);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error.text).toBe(text);
		},
	);
});

describe("toBytesBigInt", () => {
	test("converts size strings and passes bigints through", () => {
		expect(toBytesBigInt("2 EiB")).toBe(2n * 2n ** 60n);
		expect(toBytesBigInt("10 MiB")).toBe(10_485_760n);
		expect(toBytesBigInt(42n)).toBe(42n);
	});

	test("throws the parse error for text that bypassed the type", () => {
		expect(() => toBytesBigInt("10 KB" as BigByteSizeString)).toThrow(InvalidByteSizeError);
	});
});

describe("BigByteSizeString", () => {
	test("accepts the large units and rejects misspellings at compile time", () => {
		let values: BigByteSizeInput[] = ["1 EB", "1EiB", "1 ZiB", "1 yottabyte", "10 MiB", 5n];
		// @ts-expect-error a misspelled unit name
		let typo: BigByteSizeString = "10 klobyes";
		// @ts-expect-error KB is ambiguous here too
		let ambiguous: BigByteSizeString = "1 KB";
		expect([...values, typo, ambiguous]).toHaveLength(8);
	});
});
