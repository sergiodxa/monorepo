/**
 * Unit tests for `scale()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { scale } from "./scale";

describe("scale", () => {
	test("sets both scaleX and scaleY to the same factor", async () => {
		expect(await declarations(scale(1.5))).toEqual([
			"--ui-scale-x: 1.5",
			"--ui-scale-y: 1.5",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
