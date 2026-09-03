/**
 * Tests for `timingSafeEqual`.
 *
 * These pin the comparison semantics only: equality for identical bytes across
 * input forms, and inequality for anything else including length mismatches and
 * prefixes, which are the cases a naive early-exit loop would get wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { timingSafeEqual } from "./timing-safe-equal.js";

describe("timingSafeEqual", () => {
	test("returns true for identical bytes", () => {
		expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
	});

	test("returns true for identical strings compared as UTF-8", () => {
		expect(timingSafeEqual("token", "token")).toBe(true);
		expect(timingSafeEqual("tökén", "tökén")).toBe(true);
	});

	test("compares a string against its own bytes", () => {
		expect(timingSafeEqual("token", new TextEncoder().encode("token"))).toBe(true);
	});

	test("returns false when a single byte differs", () => {
		expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
	});

	test("returns false when only the first byte differs", () => {
		expect(timingSafeEqual(new Uint8Array([9, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(false);
	});

	test("returns false for a prefix of the other value", () => {
		expect(timingSafeEqual("token", "tok")).toBe(false);
		expect(timingSafeEqual("tok", "token")).toBe(false);
	});

	test("returns false when one side is empty", () => {
		expect(timingSafeEqual("", "token")).toBe(false);
		expect(timingSafeEqual("token", "")).toBe(false);
	});

	test("returns true when both sides are empty", () => {
		expect(timingSafeEqual("", "")).toBe(true);
		expect(timingSafeEqual(new Uint8Array(), new Uint8Array())).toBe(true);
	});

	test("does not treat a repeated value as equal to its repetition", () => {
		expect(timingSafeEqual(new Uint8Array([1, 2, 1, 2]), new Uint8Array([1, 2]))).toBe(false);
	});
});
