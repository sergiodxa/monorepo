/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { scrollbarColor } from "./scrollbar-color";

describe("scrollbarColor", () => {
	test("no-arg leaves the platform scrollbar alone", async () => {
		expect(await declarations(scrollbarColor())).toEqual(["scrollbar-color: auto"]);
	});

	test("a thumb alone pairs with a transparent track", async () => {
		expect(await declarations(scrollbarColor("neutral"))).toEqual([
			"scrollbar-color: var(--ui-neutral-border) transparent",
		]);
	});

	test("both colors resolve in thumb-then-track order", async () => {
		expect(await declarations(scrollbarColor("brand", "neutral"))).toEqual([
			"scrollbar-color: var(--ui-brand-border) var(--ui-neutral-bg-tint)",
		]);
	});

	test("bare tones default to border for the thumb and tint for the track", async () => {
		expect(await declarations(scrollbarColor("danger", "danger"))).toEqual([
			"scrollbar-color: var(--ui-danger-border) var(--ui-danger-bg-tint)",
		]);
	});

	test("an explicit suffix overrides each default property", async () => {
		expect(await declarations(scrollbarColor("brand.strong", "brand.solid"))).toEqual([
			"scrollbar-color: var(--ui-brand-border-strong) var(--ui-brand-bg-solid)",
		]);
	});

	test("raw palette references pass through the palette resolver", async () => {
		expect(await declarations(scrollbarColor("color.neutral.400", "color.neutral.100"))).toEqual([
			"scrollbar-color: var(--ui-color-neutral-400) var(--ui-color-neutral-100)",
		]);
	});

	test("transparent and currentColor keywords are not treated as tones", async () => {
		expect(await declarations(scrollbarColor("currentColor", "transparent"))).toEqual([
			"scrollbar-color: currentColor transparent",
		]);
	});
});
