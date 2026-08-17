/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { verticalAlign } from "./vertical-align";

describe("verticalAlign", () => {
	test("sets a known keyword", async () => {
		expect(await declarations(verticalAlign("middle"))).toEqual(["vertical-align: middle"]);
	});

	test("passes through an arbitrary value unchanged", async () => {
		expect(await declarations(verticalAlign("15%"))).toEqual(["vertical-align: 15%"]);
	});
});
