/**
 * Covers TTL fields: plain seconds, BIND's unit form summed across units, the RFC 2181 cap,
 * and long adversarial fields that must read in linear time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { looksLikeTtl, readTtl } from "./ttl.js";

describe("readTtl", () => {
	test("reads plain seconds and unit forms in any case", () => {
		expect(readTtl("3600")).toBe(3600);
		expect(readTtl("1h30m")).toBe(5400);
		expect(readTtl("2W")).toBe(1_209_600);
		expect(readTtl("1d2h3m4s")).toBe(93_784);
	});

	test("answers null for text that is not a TTL or passes 2³¹−1", () => {
		expect(readTtl("1x")).toBeNull();
		expect(readTtl("h1")).toBeNull();
		expect(readTtl(String(2 ** 31))).toBeNull();
		expect(looksLikeTtl(String(2 ** 31))).toBe(true);
	});

	test("reads a long run of digits in linear time", () => {
		let started = performance.now();
		let digits = "0".repeat(50_000);
		expect(readTtl(digits)).toBe(0);
		expect(readTtl(`${digits}x`)).toBeNull();
		expect(readTtl(`${digits}1s`.repeat(10))).toBe(10);
		expect(performance.now() - started).toBeLessThan(500);
	});
});
