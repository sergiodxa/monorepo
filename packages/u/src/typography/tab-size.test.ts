/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { tabSize } from "./tab-size.js";

describe("tabSize", () => {
	test("no-arg defaults to 2", async () => {
		expect(await declarations(tabSize())).toEqual(["tab-size: 2"]);
	});

	/**
	 * A number reaches the style serializer as a length and comes out `2px`,
	 * so it stays unitless to keep the tab sized in characters.
	 */
	test("a number is emitted unitless", async () => {
		expect(await declarations(tabSize(4))).toEqual(["tab-size: 4"]);
		expect(await declarations(tabSize(4))).not.toContain("tab-size: 4px");
	});

	test("zero", async () => {
		expect(await declarations(tabSize(0))).toEqual(["tab-size: 0"]);
	});

	test("a length string passes through", async () => {
		expect(await declarations(tabSize("4ch"))).toEqual(["tab-size: 4ch"]);
	});
});
