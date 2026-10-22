/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { assert, describe, expect, test } from "vite-plus/test";

import { bg } from "../color/bg.js";
import { border } from "../color/border.js";
import { declarations } from "../internal/serialize.js";

import { combine } from "./combine.js";
import { if as ifUtility } from "./if.js";

describe("if", () => {
	test("returns the input unchanged when condition is truthy, for a single mixin", () => {
		let input = bg("brand.tint");
		expect(ifUtility(true, input)).toBe(input);
	});

	test("returns false when condition is falsy, for a single mixin", () => {
		let input = bg("brand.tint");
		expect(ifUtility(false, input)).toBe(false);
	});

	test("merges an array input into one mixin when condition is truthy, so a mix list applies it", async () => {
		let result = ifUtility(true, [bg("brand.tint"), border("brand")]);
		expect(Array.isArray(result)).toBe(false);
		assert(result, "a truthy condition returns a mixin");
		expect(await declarations(result)).toEqual(
			await declarations(combine([bg("brand.tint"), border("brand")])),
		);
	});

	test("returns false when condition is falsy, for an array input", () => {
		let input = [bg("brand.tint"), border("brand")];
		expect(ifUtility(false, input)).toBe(false);
	});
});
