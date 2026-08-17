/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { gridAutoColumns } from "./grid-auto-columns";

describe("gridAutoColumns", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(gridAutoColumns(40))).toEqual([
			"grid-auto-columns: calc(var(--ui-spacing, 0.25rem) * 40)",
		]);
	});

	test("resolves 'full' to 100%", async () => {
		expect(await declarations(gridAutoColumns("full"))).toEqual(["grid-auto-columns: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(gridAutoColumns("10rem"))).toEqual(["grid-auto-columns: 10rem"]);
	});

	test("passes an intrinsic keyword through unchanged", async () => {
		expect(await declarations(gridAutoColumns("max-content"))).toEqual([
			"grid-auto-columns: max-content",
		]);
	});

	test("passes a minmax() clause through unchanged", async () => {
		expect(await declarations(gridAutoColumns("minmax(10rem, 1fr)"))).toEqual([
			"grid-auto-columns: minmax(10rem, 1fr)",
		]);
	});
});
