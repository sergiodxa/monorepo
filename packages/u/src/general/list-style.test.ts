/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { listStyle } from "./list-style.js";

describe("listStyle", () => {
	test("no-arg defaults to 'none'", async () => {
		expect(await declarations(listStyle())).toEqual(["list-style: none"]);
	});

	test("an explicit value", async () => {
		expect(await declarations(listStyle("decimal"))).toEqual(["list-style: decimal"]);
	});

	test("an arbitrary custom-counter-style string", async () => {
		expect(await declarations(listStyle("thumbs"))).toEqual(["list-style: thumbs"]);
	});
});
