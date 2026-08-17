/**
 * Unit tests for `maxIs()`'s `max-inline-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { maxIs } from "./max-is";

describe("maxIs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(maxIs(4))).toEqual([
			"max-inline-size: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(maxIs("full"))).toEqual(["max-inline-size: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(maxIs("60ch"))).toEqual(["max-inline-size: 60ch"]);
	});
});
