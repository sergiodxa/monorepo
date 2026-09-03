/**
 * Unit tests for `width()`'s physical `width` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { width } from "./width.js";

describe("width", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(width(4))).toEqual(["width: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(width("full"))).toEqual(["width: 100%"]);
	});

	test("passes 'fit-content' through unchanged", async () => {
		expect(await declarations(width("fit-content"))).toEqual(["width: fit-content"]);
	});
});
