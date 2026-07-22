/**
 * Unit tests for `circle()`'s fixed square-aspect-ratio/full-radius pairing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { circle } from "./circle";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("circle", () => {
	test("applies a 1:1 aspect ratio and the full radius token", () => {
		expect(styles(circle())).toEqual({
			aspectRatio: "1 / 1",
			borderRadius: "var(--ui-radius-full, 9999px)",
		});
	});
});
