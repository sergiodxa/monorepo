/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { forcedColorAdjust } from "./forced-color-adjust.js";

describe("forcedColorAdjust", () => {
	test('defaults to "none"', async () => {
		expect(await declarations(forcedColorAdjust())).toEqual(["forced-color-adjust: none"]);
	});

	test("passes an explicit keyword through", async () => {
		expect(await declarations(forcedColorAdjust("auto"))).toEqual(["forced-color-adjust: auto"]);
		expect(await declarations(forcedColorAdjust("preserve-parent-color"))).toEqual([
			"forced-color-adjust: preserve-parent-color",
		]);
	});
});
