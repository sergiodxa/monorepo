/**
 * Unit tests for `minHeight()`'s physical `min-height` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { minHeight } from "./min-height";

describe("minHeight", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(minHeight(4))).toEqual([
			"min-height: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(minHeight("full"))).toEqual(["min-height: 100%"]);
	});

	test("passes 'fit-content' through unchanged", async () => {
		expect(await declarations(minHeight("fit-content"))).toEqual(["min-height: fit-content"]);
	});
});
