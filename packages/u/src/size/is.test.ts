/**
 * Unit tests for `is()`'s `inline-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { is } from "./is.js";

describe("is", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(is(4))).toEqual([
			"inline-size: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(is("full"))).toEqual(["inline-size: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(is("60ch"))).toEqual(["inline-size: 60ch"]);
	});
});
