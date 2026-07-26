/**
 * Unit tests for `insRight()`'s physical `right` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { insRight } from "./ins-right";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("insRight", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(insRight(4))).toEqual({ right: "calc(var(--ui-spacing, 0.25rem) * 4)" });
	});

	test("accepts 'auto'", () => {
		expect(styles(insRight("auto"))).toEqual({ right: "auto" });
	});

	test("accepts 'full'", () => {
		expect(styles(insRight("full"))).toEqual({ right: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(insRight("13px"))).toEqual({ right: "13px" });
	});
});
