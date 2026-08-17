/**
 * Unit tests for `mbe()`'s `margin-block-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { mbe } from "./mbe";

describe("mbe", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(mbe(4))).toEqual([
			"margin-block-end: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("passes 'auto' through unchanged", async () => {
		expect(await declarations(mbe("auto"))).toEqual(["margin-block-end: auto"]);
	});
});
