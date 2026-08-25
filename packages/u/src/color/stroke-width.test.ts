/**
 * The serializer appends `px` to a unitless number on any property outside
 * its allow-list, so these pin `stroke-width` to unitless SVG user units.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { strokeWidth } from "./stroke-width";

describe("strokeWidth", () => {
	test("a bare number is a unitless SVG user-unit value", async () => {
		expect(await declarations(strokeWidth(2))).toEqual(["stroke-width: 2"]);
	});

	test("a string passes through unchanged", async () => {
		expect(await declarations(strokeWidth("0.5%"))).toEqual(["stroke-width: 0.5%"]);
	});

	test("the user-unit value keeps no unit, so the declaration survives the serializer", async () => {
		expect(await declarations(strokeWidth(2))).not.toContain("stroke-width: 2px");
	});
});
