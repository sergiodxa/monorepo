/**
 * Unit tests for `paddingLeft()`'s physical `padding-left` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { paddingLeft } from "./padding-left.js";

describe("paddingLeft", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(paddingLeft(4))).toEqual([
			"padding-left: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(paddingLeft("13px"))).toEqual(["padding-left: 13px"]);
	});

	test("passes a calc()/env() composite through unchanged", async () => {
		expect(
			await declarations(paddingLeft("calc(1.5rem + env(safe-area-inset-left, 0px))")),
		).toEqual(["padding-left: calc(1.5rem + env(safe-area-inset-left, 0px))"]);
	});
});
