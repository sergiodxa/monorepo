/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { outlineWidth } from "./outline-width";

describe("outlineWidth", () => {
	test("a bare number sets the width in pixels", async () => {
		expect(await declarations(outlineWidth(4))).toEqual(["outline-width: 4px"]);
	});

	test("a string passes through unchanged", async () => {
		expect(await declarations(outlineWidth("0.25rem"))).toEqual(["outline-width: 0.25rem"]);
	});

	test("sets only outlineWidth, no color or style", async () => {
		let css = await declarations(outlineWidth(4));

		expect(css.some((line) => line.startsWith("outline-color"))).toBe(false);
		expect(css.some((line) => line.startsWith("outline-style"))).toBe(false);
	});
});
