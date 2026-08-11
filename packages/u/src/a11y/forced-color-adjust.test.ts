/**
 * Unit tests for `forced-color-adjust.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { forcedColorAdjust } from "./forced-color-adjust";

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
