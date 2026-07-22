/**
 * Unit tests for `hover.ts`, sugar over `when("&:hover", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { hover } from "./hover";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("hover", () => {
	test("nests the wrapped utility's styles under '&:hover'", () => {
		expect(styles(hover(bg("brand.tint")))).toEqual({
			"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
		});
	});
});
