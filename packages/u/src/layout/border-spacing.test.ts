/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { borderSpacing } from "./border-spacing";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("borderSpacing", () => {
	test("sets a single-length value", () => {
		expect(styles(borderSpacing("0.5rem"))).toEqual({ borderSpacing: "0.5rem" });
	});

	test("sets a two-length value", () => {
		expect(styles(borderSpacing("0.5rem 1rem"))).toEqual({ borderSpacing: "0.5rem 1rem" });
	});
});
