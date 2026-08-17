/**
 * Unit tests for `maxBs()`'s `max-block-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { maxBs } from "./max-bs";

describe("maxBs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(maxBs(4))).toEqual([
			"max-block-size: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(maxBs("full"))).toEqual(["max-block-size: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(maxBs("60ch"))).toEqual(["max-block-size: 60ch"]);
	});
});
