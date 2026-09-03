/**
 * Unit tests for `rotateY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";
import { COMPOSITE_TRANSFORM } from "../internal/transform.js";

import { rotateY } from "./rotate-y.js";

describe("rotateY", () => {
	test("treats a bare number as degrees", async () => {
		expect(await declarations(rotateY(180))).toEqual([
			"--ui-rotate-y: 180deg",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
