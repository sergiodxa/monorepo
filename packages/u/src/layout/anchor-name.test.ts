/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { anchorName } from "./anchor-name";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("anchorName", () => {
	test("prefixes the name with --", () => {
		expect(styles(anchorName("tooltip-trigger"))).toEqual({
			anchorName: "--tooltip-trigger",
		});
	});

	test("prefixes a single-word name the same way", () => {
		expect(styles(anchorName("trigger"))).toEqual({ anchorName: "--trigger" });
	});
});
