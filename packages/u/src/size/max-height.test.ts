/**
 * Unit tests for `maxHeight()`'s physical `max-height` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { maxHeight } from "./max-height";

describe("maxHeight", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(maxHeight(4))).toEqual([
			"max-height: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(maxHeight("full"))).toEqual(["max-height: 100%"]);
	});

	test("passes 'fit-content' through unchanged", async () => {
		expect(await declarations(maxHeight("fit-content"))).toEqual(["max-height: fit-content"]);
	});
});
