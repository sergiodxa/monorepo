/**
 * Unit tests for the shared backdrop-filter-composability foundation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { backdropFilterFunction, COMPOSITE_BACKDROP_FILTER } from "./backdrop-filter";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("backdropFilterFunction", () => {
	test("sets the given custom property plus the shared composite backdropFilter value, on both the standard and Webkit-prefixed properties", () => {
		expect(styles(backdropFilterFunction({ blur: "12px" }))).toEqual({
			"--ui-backdrop-blur": "12px",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("sets multiple custom properties in one call", () => {
		expect(styles(backdropFilterFunction({ blur: "12px", saturate: "1.4" }))).toEqual({
			"--ui-backdrop-blur": "12px",
			"--ui-backdrop-saturate": "1.4",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("every backdrop-filter function's variable appears in the composite with an identity fallback", () => {
		expect(COMPOSITE_BACKDROP_FILTER).toContain("var(--ui-backdrop-blur, 0px)");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("var(--ui-backdrop-saturate, 1)");
	});
});
