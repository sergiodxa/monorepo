/**
 * Tests for random bytes, tokens and alphabet-sampled strings.
 *
 * Randomness itself cannot be asserted, so these pin the observable contract:
 * exact sizes, the URL-safe alphabet, the prefix shape callers grep for, that
 * every character of a custom alphabet stays inside that alphabet, and that two
 * calls never return the same value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { randomBytes, randomString, randomToken } from "./random.js";

/** Alphabet `remix-utils` uses for CSRF tokens and honeypot field names. */
const REMIX_UTILS_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";

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

describe("randomString", () => {
	test("returns 32 characters by default", () => {
		expect(randomString()).toHaveLength(32);
	});

	test("returns exactly the requested length", () => {
		expect(randomString({ length: 10 })).toHaveLength(10);
		expect(randomString({ length: 0 })).toHaveLength(0);
	});

	test("draws every character from the provided alphabet", () => {
		let value = randomString({ length: 64, alphabet: "abc" });

		expect(value).toMatch(/^[abc]{64}$/);
	});

	test("accepts the remix-utils CSRF alphabet at length 32", () => {
		let value = randomString({ length: 32, alphabet: REMIX_UTILS_ALPHABET });

		expect(value).toHaveLength(32);
		for (let character of value) {
			expect(REMIX_UTILS_ALPHABET.includes(character)).toBe(true);
		}
	});

	test("defaults to alphanumeric without punctuation", () => {
		expect(randomString({ length: 48 })).toMatch(/^[A-Za-z0-9]{48}$/);
	});

	test("rejects an empty alphabet", () => {
		expect(() => randomString({ alphabet: "" })).toThrow(RangeError);
	});

	test("rejects an alphabet longer than one byte can index", () => {
		expect(() => randomString({ alphabet: "a".repeat(257) })).toThrow(RangeError);
	});

	test("rejects lengths the runtime cannot fill", () => {
		expect(() => randomString({ length: -1 })).toThrow(RangeError);
		expect(() => randomString({ length: 1.5 })).toThrow(RangeError);
		expect(() => randomString({ length: 65537 })).toThrow(RangeError);
	});

	test("returns a different string on each call", () => {
		expect(randomString()).not.toBe(randomString());
	});

	test("does not obviously bias toward low alphabet indices", () => {
		let alphabet = "0123456789";
		let counts = Array.from({ length: alphabet.length }, () => 0);
		let samples = 10_000;

		for (let character of randomString({ length: samples, alphabet })) {
			let index = alphabet.indexOf(character);
			counts[index] = (counts[index] ?? 0) + 1;
		}

		let expected = samples / alphabet.length;
		for (let count of counts) {
			expect(count).toBeGreaterThan(expected * 0.7);
			expect(count).toBeLessThan(expected * 1.3);
		}
	});
});
