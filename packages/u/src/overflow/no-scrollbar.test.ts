/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";

import { noScrollbar } from "./no-scrollbar";

describe("noScrollbar", () => {
	test("hides the scrollbar across every browser engine", async () => {
		expect(await declarations(noScrollbar())).toEqual([
			"-ms-overflow-style: none",
			"scrollbar-width: none",
			"display: none",
		]);
	});

	test("the vendor prefix keeps its leading dash, which a camelCase key would lose", async () => {
		expect(await declarations(noScrollbar())).toContain("-ms-overflow-style: none");
	});

	test("the display: none belongs to the WebKit scrollbar pseudo-element, not the element", async () => {
		expect(await serialize(noScrollbar())).toMatch(/&::-webkit-scrollbar \{\s*display: none;\s*\}/);
	});
});
