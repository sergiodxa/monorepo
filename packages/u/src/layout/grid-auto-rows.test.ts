/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { gridAutoRows } from "./grid-auto-rows";

describe("gridAutoRows", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(gridAutoRows(24))).toEqual([
			"grid-auto-rows: calc(var(--ui-spacing, 0.25rem) * 24)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(gridAutoRows("full"))).toEqual(["grid-auto-rows: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(gridAutoRows("6rem"))).toEqual(["grid-auto-rows: 6rem"]);
	});

	test("passes an intrinsic keyword through unchanged", async () => {
		expect(await declarations(gridAutoRows("min-content"))).toEqual([
			"grid-auto-rows: min-content",
		]);
	});

	test("passes a minmax() clause through unchanged", async () => {
		expect(await declarations(gridAutoRows("minmax(6rem, auto)"))).toEqual([
			"grid-auto-rows: minmax(6rem, auto)",
		]);
	});
});
