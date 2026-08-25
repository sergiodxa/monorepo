/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { border } from "../color/border";

import { if as ifUtility } from "./if";

describe("if", () => {
	test("returns the input unchanged when condition is truthy, for a single mixin", () => {
		let input = bg("brand.tint");
		expect(ifUtility(true, input)).toBe(input);
	});

	test("returns false when condition is falsy, for a single mixin", () => {
		let input = bg("brand.tint");
		expect(ifUtility(false, input)).toBe(false);
	});

	test("returns the input unchanged when condition is truthy, for an array input", () => {
		let input = [bg("brand.tint"), border("brand")];
		expect(ifUtility(true, input)).toBe(input);
	});

	test("returns false when condition is falsy, for an array input", () => {
		let input = [bg("brand.tint"), border("brand")];
		expect(ifUtility(false, input)).toBe(false);
	});
});
