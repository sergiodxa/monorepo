/**
 * Unit tests for `scaleY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";
import { COMPOSITE_TRANSFORM } from "../internal/transform.js";

import { scaleY } from "./scale-y.js";

describe("scaleY", () => {
	test("stringifies a bare number as a unitless factor", async () => {
		expect(await declarations(scaleY(1.5))).toEqual([
			"--ui-scale-y: 1.5",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
