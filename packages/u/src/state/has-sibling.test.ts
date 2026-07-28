/**
 * Unit tests for `has-sibling.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { hasSibling } from "./has-sibling";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("hasSibling", () => {
	test("nests the input's styles under '&:has(~ selector)'", () => {
		expect(styles(hasSibling("input:checked", p(4)))).toEqual({
			"&:has(~ input:checked)": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
