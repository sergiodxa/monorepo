/**
 * Unit tests for `translateX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";
import { COMPOSITE_TRANSFORM } from "../internal/transform.js";

import { translateX } from "./translate-x.js";

describe("translateX", () => {
	test("resolves a spacing-scale value into --ui-translate-x plus the composite transform", async () => {
		expect(await declarations(translateX(4))).toEqual([
			"--ui-translate-x: calc(var(--ui-spacing, 0.25rem) * 4)",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});

	test("passes a raw CSS length through unchanged", async () => {
		expect(await declarations(translateX("10px"))).toEqual([
			"--ui-translate-x: 10px",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
