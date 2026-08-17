/**
 * Unit tests for `minWidth()`'s physical `min-width` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { minWidth } from "./min-width";

describe("minWidth", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(minWidth(4))).toEqual([
			"min-width: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(minWidth("full"))).toEqual(["min-width: 100%"]);
	});

	test("passes 'fit-content' through unchanged", async () => {
		expect(await declarations(minWidth("fit-content"))).toEqual(["min-width: fit-content"]);
	});
});
