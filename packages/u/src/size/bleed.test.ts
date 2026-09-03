/**
 * Unit tests for `bleed()`'s negative inline-margin wrapping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { bleed } from "./bleed.js";

describe("bleed", () => {
	test("defaults to 4 on the spacing scale", async () => {
		expect(await declarations(bleed())).toEqual([
			"margin-inline: calc(-1 * calc(var(--ui-spacing, 0.25rem) * 4))",
		]);
	});

	test("wraps an explicit value in the negative calc()", async () => {
		expect(await declarations(bleed(8))).toEqual([
			"margin-inline: calc(-1 * calc(var(--ui-spacing, 0.25rem) * 8))",
		]);
	});
});
