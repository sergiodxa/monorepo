/**
 * Unit tests for `minBs()`'s `min-block-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { minBs } from "./min-bs";

describe("minBs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(minBs(0))).toEqual([
			"min-block-size: calc(var(--ui-spacing, 0.25rem) * 0)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(minBs("full"))).toEqual(["min-block-size: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(minBs("60ch"))).toEqual(["min-block-size: 60ch"]);
	});
});
