/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { colorMix } from "./color-mix";

describe("colorMix", () => {
	test("bare color strings pass through unchanged with no weight", () => {
		expect(colorMix("oklab", "red", "blue")).toBe("color-mix(in oklab, red, blue)");
	});

	test("a stop object adds a percentage weight after the color", () => {
		expect(colorMix("srgb", { color: "red", weight: 30 }, "blue")).toBe(
			"color-mix(in srgb, red 30%, blue)",
		);
	});

	test("matches the exact literal replacing hardcoded color-mix strings in packages/ui", () => {
		expect(colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent")).toBe(
			"color-mix(in oklab, currentcolor 70%, transparent)",
		);
	});
});
