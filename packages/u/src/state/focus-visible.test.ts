/**
 * Unit tests for `focus-visible.ts`, sugar over `when("&:focus-visible", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { border } from "../color/border";

import { focusVisible } from "./focus-visible";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("focusVisible", () => {
	test("nests the wrapped utility's styles under '&:focus-visible'", () => {
		expect(styles(focusVisible(border("brand")))).toEqual({
			"&:focus-visible": { borderColor: "var(--ui-brand-border)" },
		});
	});
});
