/**
 * Unit tests for `bs()`'s `block-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { bs } from "./bs";

describe("bs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(bs(4))).toEqual(["block-size: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(bs("full"))).toEqual(["block-size: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(bs("60ch"))).toEqual(["block-size: 60ch"]);
	});
});
