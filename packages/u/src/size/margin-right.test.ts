/**
 * Unit tests for `marginRight()`'s physical `margin-right` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { marginRight } from "./margin-right.js";

describe("marginRight", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(marginRight(4))).toEqual([
			"margin-right: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("accepts 'auto'", async () => {
		expect(await declarations(marginRight("auto"))).toEqual(["margin-right: auto"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(marginRight("13px"))).toEqual(["margin-right: 13px"]);
	});
});
