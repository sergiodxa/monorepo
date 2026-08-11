/**
 * Unit tests for `rotateX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { rotateX } from "./rotate-x";

describe("rotateX", () => {
	test("treats a bare number as degrees", async () => {
		expect(await declarations(rotateX(180))).toEqual([
			"--ui-rotate-x: 180deg",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
