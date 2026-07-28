/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollbarColor } from "./scrollbar-color";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollbarColor", () => {
	test("no-arg leaves the platform scrollbar alone", () => {
		expect(styles(scrollbarColor())).toEqual({ scrollbarColor: "auto" });
	});

	test("a thumb alone pairs with a transparent track", () => {
		expect(styles(scrollbarColor("neutral"))).toEqual({
			scrollbarColor: "var(--ui-neutral-border) transparent",
		});
	});

	test("both colors resolve in thumb-then-track order", () => {
		expect(styles(scrollbarColor("brand", "neutral"))).toEqual({
			scrollbarColor: "var(--ui-brand-border) var(--ui-neutral-bg-tint)",
		});
	});

	test("bare tones default to border for the thumb and tint for the track", () => {
		expect(styles(scrollbarColor("danger", "danger"))).toEqual({
			scrollbarColor: "var(--ui-danger-border) var(--ui-danger-bg-tint)",
		});
	});

	test("an explicit suffix overrides each default property", () => {
		expect(styles(scrollbarColor("brand.strong", "brand.solid"))).toEqual({
			scrollbarColor: "var(--ui-brand-border-strong) var(--ui-brand-bg-solid)",
		});
	});

	test("raw palette references pass through the palette resolver", () => {
		expect(styles(scrollbarColor("color.neutral.400", "color.neutral.100"))).toEqual({
			scrollbarColor: "var(--ui-color-neutral-400) var(--ui-color-neutral-100)",
		});
	});

	test("transparent and currentColor keywords are not treated as tones", () => {
		expect(styles(scrollbarColor("currentColor", "transparent"))).toEqual({
			scrollbarColor: "currentColor transparent",
		});
	});
});
