/**
 * Unit test for the shared anchor placement union in
 * {@link "./placement"}: verifies the twelve-value literal set every
 * anchored surface's `Placement` type resolves to matches this module's
 * list, keeping the two in sync automatically.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { AnchorPlacement } from "./placement";

describe("AnchorPlacement", () => {
	test("is exactly the twelve placements every anchored surface renders against", () => {
		let placements: readonly AnchorPlacement[] = [
			"top",
			"top-start",
			"top-end",
			"bottom",
			"bottom-start",
			"bottom-end",
			"left",
			"left-start",
			"left-end",
			"right",
			"right-start",
			"right-end",
		];

		expect(placements).toEqual([
			"top",
			"top-start",
			"top-end",
			"bottom",
			"bottom-start",
			"bottom-end",
			"left",
			"left-start",
			"left-end",
			"right",
			"right-start",
			"right-end",
		]);
	});
});
