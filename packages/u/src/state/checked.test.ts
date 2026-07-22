/**
 * Unit tests for `checked.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { checked } from "./checked";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("checked", () => {
	test("nests the wrapped utility's styles under '&:checked, &[aria-checked=\"true\"]'", () => {
		expect(styles(checked(bg("brand.solid")))).toEqual({
			'&:checked, &[aria-checked="true"]': { backgroundColor: "var(--ui-brand-bg-solid)" },
		});
	});
});
