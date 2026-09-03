/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { outlineStyle } from "./outline-style.js";

describe("outlineStyle", () => {
	test("sets the outline style", async () => {
		expect(await declarations(outlineStyle("dashed"))).toEqual(["outline-style: dashed"]);
	});

	test("sets only outlineStyle, no color or width", async () => {
		let css = await declarations(outlineStyle("dotted"));

		expect(css.some((line) => line.startsWith("outline-color"))).toBe(false);
		expect(css.some((line) => line.startsWith("outline-width"))).toBe(false);
	});
});
