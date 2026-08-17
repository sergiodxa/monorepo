/**
 * Unit tests for `scaleX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { scaleX } from "./scale-x";

describe("scaleX", () => {
	test("stringifies a bare number as a unitless factor", async () => {
		expect(await declarations(scaleX(1.5))).toEqual([
			"--ui-scale-x: 1.5",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});

	test("the factor stays unitless, so scale() gets a number rather than a length", async () => {
		// `scale()` takes a unitless factor; a `px` suffix would make the whole
		// function invalid and drop the transform. Custom properties are exempt
		// from the serializer's unit-appending, which is what keeps this safe.
		expect(await declarations(scaleX(1.5))).not.toContain("--ui-scale-x: 1.5px");
	});

	test("passes a string through unchanged", async () => {
		expect(await declarations(scaleX("150%"))).toEqual([
			"--ui-scale-x: 150%",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
