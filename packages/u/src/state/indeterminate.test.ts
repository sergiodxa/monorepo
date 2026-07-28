/**
 * Unit tests for `indeterminate.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { indeterminate } from "./indeterminate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("indeterminate", () => {
	test("nests the wrapped utility's styles under '&:indeterminate, &[aria-checked=\"mixed\"]'", () => {
		expect(styles(indeterminate(bg("brand.solid")))).toEqual({
			'&:indeterminate, &[aria-checked="mixed"]': {
				backgroundColor: "var(--ui-brand-bg-solid)",
			},
		});
	});
});
