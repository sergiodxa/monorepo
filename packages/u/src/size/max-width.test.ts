/**
 * Unit tests for `maxWidth()`'s physical `max-width` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { maxWidth } from "./max-width.js";

describe("maxWidth", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(maxWidth(4))).toEqual([
			"max-width: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(maxWidth("full"))).toEqual(["max-width: 100%"]);
	});

	test("passes 'fit-content' through unchanged", async () => {
		expect(await declarations(maxWidth("fit-content"))).toEqual(["max-width: fit-content"]);
	});
});
