/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { type } from "./type";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("type", () => {
	test("combines text()'s font-size/line-height with the base sans font family", () => {
		expect(styles(type("lg"))).toEqual({
			fontFamily: "var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)",
			fontSize: "var(--ui-text-lg, 1.125rem)",
			lineHeight: "var(--ui-leading-lg, calc(1.75 / 1.125))",
		});
	});

	test("always opinionates the family to sans regardless of the text size requested", () => {
		expect(styles(type("3xl"))).toEqual({
			fontFamily: "var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)",
			fontSize: "var(--ui-text-3xl, 1.875rem)",
			lineHeight: "var(--ui-leading-3xl, 1.2)",
		});
	});
});
