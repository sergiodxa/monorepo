/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { textTransform } from "./text-transform.js";

describe("textTransform", () => {
	test("applies the given text-transform value", async () => {
		expect(await declarations(textTransform("uppercase"))).toEqual(["text-transform: uppercase"]);
	});

	test("accepts 'none' to remove a transform", async () => {
		expect(await declarations(textTransform("none"))).toEqual(["text-transform: none"]);
	});
});
