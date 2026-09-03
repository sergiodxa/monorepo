/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { overflowX } from "./overflow-x.js";

describe("overflowX", () => {
	test("defaults to hidden", async () => {
		expect(await declarations(overflowX())).toEqual(["overflow-x: hidden"]);
	});

	test("accepts an explicit value", async () => {
		expect(await declarations(overflowX("auto"))).toEqual(["overflow-x: auto"]);
	});
});
