/**
 * Unit tests for `objectPosition()`'s `object-position` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { objectPosition } from "./object-position";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("objectPosition", () => {
	test("defaults to 'center'", () => {
		expect(styles(objectPosition())).toEqual({ objectPosition: "center" });
	});

	test("applies a keyword value", () => {
		expect(styles(objectPosition("top"))).toEqual({ objectPosition: "top" });
	});

	test("applies a two-keyword value", () => {
		expect(styles(objectPosition("bottom right"))).toEqual({ objectPosition: "bottom right" });
	});

	test("a raw length or percentage pair passes through unchanged", () => {
		expect(styles(objectPosition("50% 20%"))).toEqual({ objectPosition: "50% 20%" });
	});
});
