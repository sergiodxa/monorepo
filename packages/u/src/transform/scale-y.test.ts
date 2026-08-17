/**
 * Unit tests for `scaleY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { scaleY } from "./scale-y";

describe("scaleY", () => {
	test("stringifies a bare number as a unitless factor", async () => {
		expect(await declarations(scaleY(1.5))).toEqual([
			"--ui-scale-y: 1.5",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
