/**
 * Unit tests for `active.ts`, sugar over `when("&:active", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { active } from "./active";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("active", () => {
	test("nests the wrapped utility's styles under '&:active'", () => {
		expect(styles(active(bg("brand.solid")))).toEqual({
			"&:active": { backgroundColor: "var(--ui-brand-bg-solid)" },
		});
	});
});
