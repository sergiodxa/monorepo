/**
 * Unit tests for `height()`'s physical `height` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { height } from "./height";

describe("height", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(height(4))).toEqual(["height: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(height("full"))).toEqual(["height: 100%"]);
	});

	test("passes 'fit-content' through unchanged", async () => {
		expect(await declarations(height("fit-content"))).toEqual(["height: fit-content"]);
	});
});
