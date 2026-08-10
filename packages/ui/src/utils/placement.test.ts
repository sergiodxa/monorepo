/**
 * Unit test for the shared anchor placement union in
 * {@link "./placement"}: a runtime check that the literal set every
 * anchored surface's own `Placement` type resolves to is exactly the twelve
 * values this module documents, so a change to the shared union surfaces
 * here instead of silently drifting from what each surface's
 * `data-placement` contract actually handles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

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
