/**
 * Unit tests for `skewX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";
import { COMPOSITE_TRANSFORM } from "../internal/transform.js";

import { skewX } from "./skew-x.js";

describe("skewX", () => {
	test("treats a bare number as degrees", async () => {
		expect(await declarations(skewX(10))).toEqual([
			"--ui-skew-x: 10deg",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
