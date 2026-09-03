/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { overflowInline } from "./overflow-inline.js";

describe("overflowInline", () => {
	test("defaults to hidden", async () => {
		expect(await declarations(overflowInline())).toEqual(["overflow-inline: hidden"]);
	});

	test("accepts an explicit value", async () => {
		expect(await declarations(overflowInline("auto"))).toEqual(["overflow-inline: auto"]);
	});
});
