/**
 * Unit tests for `starting-style.ts`, the `@starting-style` at-rule wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { opacity } from "../effects/opacity.js";
import { declarations, serialize } from "../internal/serialize.js";

import { startingStyle } from "./starting-style.js";

describe("startingStyle", () => {
	test("nests the wrapped utility's styles under '@starting-style'", async () => {
		expect(await serialize(startingStyle(opacity(0)))).toMatch(
			/@starting-style \{[\s\S]*opacity: 0;/,
		);
	});

	/**
	 * A `0px` opacity is invalid, and a dropped starting opacity means the
	 * entry transition begins from the element's final value — no animation.
	 */
	test("a zero opacity survives the serializer as a unitless number", async () => {
		expect(await declarations(startingStyle(opacity(0)))).toEqual(["opacity: 0"]);
	});
});
