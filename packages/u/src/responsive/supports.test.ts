/**
 * Unit tests for `supports.ts`, the `@supports` feature-query wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { supports } from "./supports";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("supports", () => {
	test("nests the wrapped utility's styles under '@supports <query>'", () => {
		expect(styles(supports("(corner-shape: squircle)", p(4)))).toEqual({
			"@supports (corner-shape: squircle)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});
});
