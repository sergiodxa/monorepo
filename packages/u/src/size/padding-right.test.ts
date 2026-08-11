/**
 * Unit tests for `paddingRight()`'s physical `padding-right` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { paddingRight } from "./padding-right";

describe("paddingRight", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(paddingRight(4))).toEqual([
			"padding-right: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(paddingRight("13px"))).toEqual(["padding-right: 13px"]);
	});

	test("passes a calc()/env() composite through unchanged", async () => {
		expect(
			await declarations(paddingRight("calc(1.5rem + env(safe-area-inset-right, 0px))")),
		).toEqual(["padding-right: calc(1.5rem + env(safe-area-inset-right, 0px))"]);
	});
});
