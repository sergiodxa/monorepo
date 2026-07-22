/**
 * Unit tests for `interpolateSize()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { interpolateSize } from "./interpolate-size";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("interpolateSize", () => {
	test("defaults to allow-keywords", () => {
		expect(styles(interpolateSize())).toEqual({ interpolateSize: "allow-keywords" });
	});

	test("accepts an explicit value", () => {
		expect(styles(interpolateSize("numeric-only"))).toEqual({ interpolateSize: "numeric-only" });
	});
});
