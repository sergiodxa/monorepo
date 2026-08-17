/**
 * Unit tests for `translateY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { translateY } from "./translate-y";

describe("translateY", () => {
	test("resolves a spacing-scale value into --ui-translate-y plus the composite transform", async () => {
		expect(await declarations(translateY(4))).toEqual([
			"--ui-translate-y: calc(var(--ui-spacing, 0.25rem) * 4)",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});
});
