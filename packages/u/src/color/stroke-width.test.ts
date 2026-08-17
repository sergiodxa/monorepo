/**
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
		// The serializer appends `px` to any unitless number on a property outside
		// its allow-list, which would silently switch the stroke to pixel widths.
		expect(await declarations(strokeWidth(2))).not.toContain("stroke-width: 2px");
	});
});
