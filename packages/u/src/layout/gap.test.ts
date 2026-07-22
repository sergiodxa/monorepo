/**
 * Unit tests for `gap()`'s 1/2-value `gap` resolution built on the shared
 * `resolveEdge` helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { gap } from "./gap";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("gap", () => {
	test("one value applies to both row and column gap", () => {
		expect(styles(gap(4))).toEqual({
			gap: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values are read as row then column", () => {
		expect(styles(gap(2, 4))).toEqual({
			gap: "calc(var(--ui-spacing, 0.25rem) * 2) calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("throws for an unsupported value count", () => {
		expect(() => gap()).toThrow();
		expect(() => gap(1, 2, 3)).toThrow();
	});
});
