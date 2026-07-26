/**
 * Unit tests for `mask()` mirroring its image onto both the standard and
 * `-webkit-` prefixed mask-image properties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mask } from "./mask";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mask", () => {
	test("mirrors a gradient onto both the standard and webkit-prefixed properties", () => {
		expect(styles(mask("linear-gradient(to bottom, transparent, black)"))).toEqual({
			maskImage: "linear-gradient(to bottom, transparent, black)",
			WebkitMaskImage: "linear-gradient(to bottom, transparent, black)",
		});
	});

	test("mirrors a url() reference the same way", () => {
		expect(styles(mask("url(#ring-mask)"))).toEqual({
			maskImage: "url(#ring-mask)",
			WebkitMaskImage: "url(#ring-mask)",
		});
	});
});
