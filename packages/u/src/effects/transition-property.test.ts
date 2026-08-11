/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { transitionProperty } from "./transition-property";

describe("transitionProperty", () => {
	test("sets only transition-property", async () => {
		expect(await declarations(transitionProperty("transform"))).toEqual([
			"transition-property: transform",
		]);
	});

	test("passes through a multi-property list unchanged", async () => {
		expect(await declarations(transitionProperty("color, background-color"))).toEqual([
			"transition-property: color, background-color",
		]);
	});
});
