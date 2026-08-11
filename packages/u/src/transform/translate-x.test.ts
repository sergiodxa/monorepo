/**
 * Unit tests for `translateX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { translateX } from "./translate-x";

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
