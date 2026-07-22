/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { leading } from "./leading";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("leading", () => {
	test("every named scale value resolves through the leading variable with its fallback", () => {
		expect(styles(leading("none"))).toEqual({ lineHeight: "var(--ui-leading-none, 1)" });
		expect(styles(leading("tight"))).toEqual({ lineHeight: "var(--ui-leading-tight, 1.25)" });
		expect(styles(leading("snug"))).toEqual({ lineHeight: "var(--ui-leading-snug, 1.375)" });
		expect(styles(leading("normal"))).toEqual({ lineHeight: "var(--ui-leading-normal, 1.5)" });
		expect(styles(leading("relaxed"))).toEqual({ lineHeight: "var(--ui-leading-relaxed, 1.625)" });
		expect(styles(leading("loose"))).toEqual({ lineHeight: "var(--ui-leading-loose, 2)" });
	});

	test("a raw number passes through unchanged as a unitless multiplier", () => {
		expect(styles(leading(1.8))).toEqual({ lineHeight: 1.8 });
	});

	test("no-arg defaults to normal", () => {
		expect(styles(leading())).toEqual({ lineHeight: "var(--ui-leading-normal, 1.5)" });
	});
});
