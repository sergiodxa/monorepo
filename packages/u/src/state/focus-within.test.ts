/**
 * Unit tests for `focus-within.ts`, sugar over `when("&:focus-within", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { border } from "../color/border";

import { focusWithin } from "./focus-within";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("focusWithin", () => {
	test("nests the wrapped utility's styles under '&:focus-within'", () => {
		expect(styles(focusWithin(border("brand")))).toEqual({
			"&:focus-within": { borderColor: "var(--ui-brand-border)" },
		});
	});
});
