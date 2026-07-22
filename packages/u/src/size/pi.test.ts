/**
 * Unit tests for `pi()`'s 1/2-value `padding-inline` shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { pi } from "./pi";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("pi", () => {
	test("one value applies both inline edges", () => {
		expect(styles(pi(4))).toEqual({
			paddingInline: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to inline-start then inline-end", () => {
		expect(styles(pi(1, 2))).toEqual({
			paddingInline: "calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2)",
		});
	});
});
