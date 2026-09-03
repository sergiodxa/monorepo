/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { boxSizing } from "./box-sizing.js";

describe("boxSizing", () => {
	test("'border-box'", async () => {
		expect(await declarations(boxSizing("border-box"))).toEqual(["box-sizing: border-box"]);
	});

	test("'content-box'", async () => {
		expect(await declarations(boxSizing("content-box"))).toEqual(["box-sizing: content-box"]);
	});
});
