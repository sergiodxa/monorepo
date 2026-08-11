/**
 * Unit tests for `minIs()`'s `min-inline-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { minIs } from "./min-is";

describe("minIs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(minIs(0))).toEqual([
			"min-inline-size: calc(var(--ui-spacing, 0.25rem) * 0)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(minIs("full"))).toEqual(["min-inline-size: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(minIs("60ch"))).toEqual(["min-inline-size: 60ch"]);
	});
});
