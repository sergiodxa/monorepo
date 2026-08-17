/**
 * Unit tests for `marginLeft()`'s physical `margin-left` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { marginLeft } from "./margin-left";

describe("marginLeft", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(marginLeft(4))).toEqual([
			"margin-left: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("accepts 'auto'", async () => {
		expect(await declarations(marginLeft("auto"))).toEqual(["margin-left: auto"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(marginLeft("13px"))).toEqual(["margin-left: 13px"]);
	});
});
