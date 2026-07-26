/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { transitionDuration } from "./transition-duration";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transitionDuration", () => {
	test("sets only transition-duration", () => {
		expect(styles(transitionDuration("0s"))).toEqual({
			transitionDuration: "0s",
		});
	});

	test("passes through an arbitrary duration string unchanged", () => {
		expect(styles(transitionDuration("300ms"))).toEqual({
			transitionDuration: "300ms",
		});
	});
});
