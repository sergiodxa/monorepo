/**
 * Known-answer tests for the bucketing hash. Every expectation is a published
 * MurmurHash3 x86 32-bit vector at seed 0, because a hash that is merely
 * self-consistent would still put every subject in a different bucket.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import { murmurHash3 } from "./hash.js";

test.each([
	["", 0],
	["a", 1_009_084_850],
	["ab", 2_613_040_991],
	["abc", 3_017_643_002],
	["abcd", 1_139_631_978],
	["Hello, world!", 3_224_780_355],
] as const)("hashes %j to the published vector", (input, expected) => {
	expect(murmurHash3(input)).toBe(expected);
});

test.each([
	["The quick brown fox jumps over the lazy ", 4_048_945_493],
	["The quick brown fox jumps over the lazy d", 1_648_763_036],
	["The quick brown fox jumps over the lazy do", 1_052_638_611],
	["The quick brown fox jumps over the lazy dog", 776_992_547],
] as const)("hashes %j, exercising each trailing partial word", (input, expected) => {
	expect(murmurHash3(input)).toBe(expected);
});

test("hashes the UTF-8 bytes of a string rather than its code units", () => {
	expect(murmurHash3("naïve café 🚀")).toBe(2_558_167_198);
});

test("answers with an unsigned 32-bit integer", () => {
	let hash = murmurHash3("The quick brown fox jumps over the lazy ");

	expect(hash).toBeGreaterThan(2 ** 31);
	expect(hash).toBeLessThan(2 ** 32);
	expect(Number.isInteger(hash)).toBe(true);
});

test("puts the same subject in the same place on every call", () => {
	expect(murmurHash3("welcome-banneruser-42")).toBe(2_364_819_184);
	expect(murmurHash3("welcome-banneruser-42")).toBe(murmurHash3("welcome-banneruser-42"));
});
