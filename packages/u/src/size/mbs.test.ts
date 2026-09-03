/**
 * Unit tests for `mbs()`'s `margin-block-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { mbs } from "./mbs.js";

describe("mbs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(mbs(4))).toEqual([
			"margin-block-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("passes 'auto' through unchanged", async () => {
		expect(await declarations(mbs("auto"))).toEqual(["margin-block-start: auto"]);
	});
});
