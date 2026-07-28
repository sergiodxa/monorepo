/**
 * Unit tests for `read-only.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { readOnly } from "./read-only";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("readOnly", () => {
	test("nests the wrapped utility's styles under '&:read-only, &[aria-readonly=\"true\"]'", () => {
		expect(styles(readOnly(bg("brand.tint")))).toEqual({
			'&:read-only, &[aria-readonly="true"]': { backgroundColor: "var(--ui-brand-bg-tint)" },
		});
	});
});
