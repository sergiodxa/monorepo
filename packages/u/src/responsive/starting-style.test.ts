/**
 * Unit tests for `starting-style.ts`, the `@starting-style` at-rule wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { opacity } from "../effects/opacity";
import { declarations, serialize } from "../internal/serialize";

import { startingStyle } from "./starting-style";

describe("startingStyle", () => {
	test("nests the wrapped utility's styles under '@starting-style'", async () => {
		expect(await serialize(startingStyle(opacity(0)))).toMatch(
			/@starting-style \{[\s\S]*opacity: 0;/,
		);
	});

	test("a zero opacity survives the serializer as a unitless number", async () => {
		// A `0px` opacity is invalid, and a dropped starting opacity means the
		// entry transition begins from the element's final value — no animation.
		expect(await declarations(startingStyle(opacity(0)))).toEqual(["opacity: 0"]);
	});
});
