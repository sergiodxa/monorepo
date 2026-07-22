/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { ring } from "./ring";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("ring", () => {
	test("no-arg resolves the system default, nested under &:focus-visible", () => {
		expect(styles(ring())).toEqual({
			"&:focus-visible": {
				outlineWidth: "2px",
				outlineStyle: "solid",
				outlineOffset: "2px",
				outlineColor: "var(--ui-ring, Highlight)",
			},
		});
	});

	test("never nests under plain :focus", () => {
		expect(styles(ring())).not.toHaveProperty(":focus");
		expect(styles(ring())).not.toHaveProperty("&:focus");
	});

	test("an explicit tone, still nested under &:focus-visible", () => {
		expect(styles(ring("danger"))).toEqual({
			"&:focus-visible": {
				outlineWidth: "2px",
				outlineStyle: "solid",
				outlineOffset: "2px",
				outlineColor: "var(--ui-danger-ring)",
			},
		});
	});
});
