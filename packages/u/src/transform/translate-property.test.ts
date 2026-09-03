/**
 * Unit tests for `translateProperty()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { translateProperty } from "./translate-property.js";

describe("translateProperty", () => {
	test("passes a two-axis percentage shorthand through unchanged", async () => {
		expect(await declarations(translateProperty("0 -50%"))).toEqual(["translate: 0 -50%"]);
	});

	test("passes the opposite-axis percentage shorthand through unchanged", async () => {
		expect(await declarations(translateProperty("-50% 0"))).toEqual(["translate: -50% 0"]);
	});
});
