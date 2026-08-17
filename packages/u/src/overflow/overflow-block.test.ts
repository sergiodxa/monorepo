/**
 * Unit tests for `overflowBlock()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { overflowBlock } from "./overflow-block";

describe("overflowBlock", () => {
	test("defaults to hidden", async () => {
		expect(await declarations(overflowBlock())).toEqual(["overflow-block: hidden"]);
	});

	test("accepts an explicit value", async () => {
		expect(await declarations(overflowBlock("auto"))).toEqual(["overflow-block: auto"]);
	});
});
