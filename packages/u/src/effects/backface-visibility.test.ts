/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { backfaceVisibility } from "./backface-visibility";

describe("backfaceVisibility", () => {
	test("defaults to hidden", async () => {
		expect(await declarations(backfaceVisibility())).toEqual(["backface-visibility: hidden"]);
	});

	test("accepts an explicit value", async () => {
		expect(await declarations(backfaceVisibility("visible"))).toEqual([
			"backface-visibility: visible",
		]);
	});
});
