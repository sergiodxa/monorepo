/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";

import { backdropDropShadow } from "./backdrop-drop-shadow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("backdropDropShadow", () => {
	test("no-arg defaults resolve through the spacing scale and a literal color", () => {
		expect(styles(backdropDropShadow())).toEqual({
			"--ui-backdrop-drop-shadow":
				"calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15)",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("raw lengths pass through and a bare tone resolves through the token layer", () => {
		expect(styles(backdropDropShadow({ x: "1px", y: "2px", blur: "4px", color: "brand" }))).toEqual(
			{
				"--ui-backdrop-drop-shadow": "1px 2px 4px var(--ui-brand-border)",
				backdropFilter: COMPOSITE_BACKDROP_FILTER,
				WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
			},
		);
	});

	test("the composite carries a drop-shadow slot", () => {
		expect(COMPOSITE_BACKDROP_FILTER).toContain(
			"drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))",
		);
	});
});
