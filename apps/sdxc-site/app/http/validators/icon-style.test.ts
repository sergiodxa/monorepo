/**
 * Reading a customization from an address: each field holds on its own, so a link with one
 * bad value still draws the parts that are right.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { readIconStyle } from "~/app/http/validators/icon-style";
import { DEFAULT_ICON_STYLE } from "~/app/services/icon-style";

describe("readIconStyle", () => {
	test("reads every field the controls write", () => {
		let params = new URLSearchParams("size=32&stroke=1.25&absolute=1&color=%23AABBCC");
		expect(readIconStyle(params)).toEqual({
			size: 32,
			strokeWidth: 1.25,
			absoluteStrokeWidth: true,
			color: "#aabbcc",
		});
	});

	test("reads a checked box the way a form submits it", () => {
		expect(readIconStyle(new URLSearchParams("absolute=on")).absoluteStrokeWidth).toBe(true);
	});

	test("answers the default for an empty address", () => {
		expect(readIconStyle(new URLSearchParams())).toEqual(DEFAULT_ICON_STYLE);
	});

	test("drops only the field that is out of range or malformed", () => {
		let style = readIconStyle(new URLSearchParams("size=2&stroke=abc&color=red&absolute=yes"));
		expect(style).toEqual(DEFAULT_ICON_STYLE);

		expect(readIconStyle(new URLSearchParams("size=2&stroke=3")).strokeWidth).toBe(3);
	});
});
