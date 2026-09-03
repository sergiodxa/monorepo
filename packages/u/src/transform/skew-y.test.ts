/**
 * Unit tests for `skewY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";
import { COMPOSITE_TRANSFORM } from "../internal/transform.js";

import { skewY } from "./skew-y.js";

describe("skewY", () => {
	test("treats a bare number as degrees", async () => {
		expect(await declarations(skewY(10))).toEqual([
			"--ui-skew-y: 10deg",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
