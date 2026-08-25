/**
 * Tests for random bytes and tokens.
 *
 * Randomness itself cannot be asserted, so these pin the observable contract:
 * exact sizes, the URL-safe alphabet, the prefix shape callers grep for, and that
 * two calls never return the same value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { randomBytes, randomToken } from "./random";

describe("randomBytes", () => {
	test("returns exactly the requested number of bytes", () => {
		expect(randomBytes(1).length).toBe(1);
		expect(randomBytes(32).length).toBe(32);
		expect(randomBytes(0).length).toBe(0);
	});

	test("returns a different value on each call", () => {
		let first = randomBytes(32);
		let second = randomBytes(32);

		expect(first).not.toEqual(second);
	});

	test("rejects sizes the runtime cannot fill", () => {
		expect(() => randomBytes(-1)).toThrow(RangeError);
		expect(() => randomBytes(1.5)).toThrow(RangeError);
		expect(() => randomBytes(65537)).toThrow(RangeError);
	});
});

describe("randomToken", () => {
	test("returns a URL-safe token by default", () => {
		expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	test("encodes 32 bytes of entropy by default", () => {
		expect(randomToken()).toHaveLength(43);
	});

	test("honors the requested entropy", () => {
		expect(randomToken({ bytes: 16 })).toHaveLength(22);
	});

	test("joins the prefix with an underscore", () => {
		expect(randomToken({ bytes: 16, prefix: "sk" })).toMatch(/^sk_[A-Za-z0-9_-]{22}$/);
	});

	test("keeps a multi-word prefix verbatim", () => {
		expect(randomToken({ bytes: 16, prefix: "sdx_auth" }).startsWith("sdx_auth_")).toBe(true);
	});

	test("returns a different token on each call", () => {
		expect(randomToken()).not.toBe(randomToken());
	});
});
