/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { caretColor } from "./caret-color";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("caretColor", () => {
	test("with no value it emits CSS's own auto default", () => {
		expect(styles(caretColor())).toEqual({ caretColor: "auto" });
	});

	test("a bare tone resolves that tone's plain foreground weight", () => {
		expect(styles(caretColor("brand"))).toEqual({ caretColor: "var(--ui-brand-fg)" });
	});

	test("an explicit suffix resolves through the alias table", () => {
		expect(styles(caretColor("brand.emphasis"))).toEqual({
			caretColor: "var(--ui-brand-fg-emphasis)",
		});
	});

	test("a raw palette reference resolves to its palette variable", () => {
		expect(styles(caretColor("color.neutral.50"))).toEqual({
			caretColor: "var(--ui-color-neutral-50)",
		});
	});

	test("transparent passes through as a CSS keyword", () => {
		expect(styles(caretColor("transparent"))).toEqual({ caretColor: "transparent" });
	});
});
