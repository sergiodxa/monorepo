/**
 * Unit tests for `safeAreaPadding()`'s per-side `env(safe-area-inset-*)`
 * physical padding declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { safeAreaPadding } from "./safe-area-padding";

describe("safeAreaPadding", () => {
	test("defaults the fallback to 0px, on the bottom side", async () => {
		expect(await declarations(safeAreaPadding("bottom"))).toEqual([
			"padding-bottom: env(safe-area-inset-bottom, 0px)",
		]);
	});

	test("the top side", async () => {
		expect(await declarations(safeAreaPadding("top"))).toEqual([
			"padding-top: env(safe-area-inset-top, 0px)",
		]);
	});

	test("the left side", async () => {
		expect(await declarations(safeAreaPadding("left"))).toEqual([
			"padding-left: env(safe-area-inset-left, 0px)",
		]);
	});

	test("the right side", async () => {
		expect(await declarations(safeAreaPadding("right"))).toEqual([
			"padding-right: env(safe-area-inset-right, 0px)",
		]);
	});

	test("an explicit fallback", async () => {
		expect(await declarations(safeAreaPadding("top", "1rem"))).toEqual([
			"padding-top: env(safe-area-inset-top, 1rem)",
		]);
	});
});
