/**
 * Unit tests for `skewX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { skewX } from "./skew-x";

describe("skewX", () => {
	test("treats a bare number as degrees", async () => {
		expect(await declarations(skewX(10))).toEqual([
			"--ui-skew-x: 10deg",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
