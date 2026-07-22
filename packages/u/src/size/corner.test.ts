/**
 * Unit tests for `corner()`'s `@supports`-gated `corner-shape` primitive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { corner } from "./corner";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("corner", () => {
	test("nests 'squircle' under an @supports block for that shape", () => {
		expect(styles(corner("squircle"))).toEqual({
			"@supports (corner-shape: squircle)": { cornerShape: "squircle" },
		});
	});

	test("nests 'bevel' under an @supports block for that shape", () => {
		expect(styles(corner("bevel"))).toEqual({
			"@supports (corner-shape: bevel)": { cornerShape: "bevel" },
		});
	});

	test("nests 'notch' under an @supports block for that shape", () => {
		expect(styles(corner("notch"))).toEqual({
			"@supports (corner-shape: notch)": { cornerShape: "notch" },
		});
	});
});
