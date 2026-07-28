/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { positionAnchor } from "./position-anchor";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("positionAnchor", () => {
	test("prefixes the name with --", () => {
		expect(styles(positionAnchor("tooltip-trigger"))).toEqual({
			positionAnchor: "--tooltip-trigger",
		});
	});

	test("prefixes a single-word name the same way", () => {
		expect(styles(positionAnchor("trigger"))).toEqual({ positionAnchor: "--trigger" });
	});
});
