/**
 * Tests for the conversion to bytes and for the size string type: numbers pass
 * through, strings convert, accepted forms type-check, and the malformed ones the
 * `@ts-expect-error` directives mark fail the typecheck if they ever compile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { ByteSizeInput, ByteSizeString } from "./types.js";

import { toBytes } from "./to-bytes.js";

describe("toBytes", () => {
	test("converts size strings", () => {
		expect(toBytes("10 MiB")).toBe(10 * 1024 * 1024);
		expect(toBytes("10 MB")).toBe(10_000_000);
		expect(toBytes("5GiB")).toBe(5 * 1024 ** 3);
		expect(toBytes("4 kibibytes")).toBe(4096);
	});

	test("passes a number of bytes through unchanged", () => {
		expect(toBytes(1500)).toBe(1500);
		expect(toBytes(0)).toBe(0);
	});

	test("answers NaN for text that bypassed the type", () => {
		expect(toBytes("10 KB" as ByteSizeString)).toBeNaN();
	});
});

describe("ByteSizeString", () => {
	test("accepts symbols with or without a space and names after one", () => {
		let values: ByteSizeString[] = [
			"512 B",
			"512B",
			"1 kB",
			"10 MB",
			"10MB",
			"1 GB",
			"1 TB",
			"1 PB",
			"1 KiB",
			"10 MiB",
			"10MiB",
			"1 GiB",
			"1 TiB",
			"1 PiB",
			"1 byte",
			"10 megabytes",
			"10 mebibytes",
		];
		expect(values.map(toBytes).every(Number.isSafeInteger)).toBe(true);
	});

	test("rejects malformed sizes at compile time", () => {
		// @ts-expect-error KB is ambiguous; write kB or KiB
		let ambiguous: ByteSizeString = "10 KB";
		// @ts-expect-error symbols are case-sensitive
		let lowercase: ByteSizeString = "10 mb";
		// @ts-expect-error a long name needs its space
		let unspaced: ByteSizeString = "10megabytes";
		// @ts-expect-error amounts are whole numbers
		let fraction: ByteSizeString = "1.5 GB";
		expect([ambiguous, lowercase, unspaced, fraction]).toHaveLength(4);
	});
});

describe("ByteSizeInput", () => {
	test("accepts a size string or a number of bytes", () => {
		let inputs: ByteSizeInput[] = ["1 KiB", "1kB", 1024];
		expect(inputs.map(toBytes)).toEqual([1024, 1000, 1024]);
	});
});
