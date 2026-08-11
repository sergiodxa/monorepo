/**
 * Unit tests for `skewY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { skewY } from "./skew-y";

describe("skewY", () => {
	test("treats a bare number as degrees", async () => {
		expect(await declarations(skewY(10))).toEqual([
			"--ui-skew-y: 10deg",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
