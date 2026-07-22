/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { surface } from "./surface";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("surface", () => {
	test("default recipe uses the system bg/fg/border trio", () => {
		expect(styles(surface())).toEqual({
			backgroundColor: "var(--ui-bg, Canvas)",
			color: "var(--ui-fg, CanvasText)",
			borderColor: "var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))",
		});
	});

	test("muted recipe uses the neutral tone", () => {
		expect(styles(surface("muted"))).toEqual({
			backgroundColor: "var(--ui-neutral-bg-tint)",
			color: "var(--ui-neutral-fg)",
			borderColor: "var(--ui-neutral-border)",
		});
	});

	test("a bare tone resolves the solid recipe", () => {
		expect(styles(surface("brand"))).toEqual({
			backgroundColor: "var(--ui-brand-bg-solid)",
			color: "var(--ui-brand-fg-on-solid)",
			borderColor: "var(--ui-brand-bg-solid)",
		});
	});

	test("a tinted brand recipe", () => {
		expect(styles(surface("brand.tinted"))).toEqual({
			backgroundColor: "var(--ui-brand-bg-tint)",
			color: "var(--ui-brand-fg-emphasis)",
			borderColor: "var(--ui-brand-border)",
		});
	});

	test("a tinted danger recipe", () => {
		expect(styles(surface("danger.tinted"))).toEqual({
			backgroundColor: "var(--ui-danger-bg-tint)",
			color: "var(--ui-danger-fg-emphasis)",
			borderColor: "var(--ui-danger-border)",
		});
	});
});
