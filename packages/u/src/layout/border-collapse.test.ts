/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { borderCollapse } from "./border-collapse";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("borderCollapse", () => {
	test("no-arg defaults to 'collapse'", () => {
		expect(styles(borderCollapse())).toEqual({ borderCollapse: "collapse" });
	});

	test("an explicit value", () => {
		expect(styles(borderCollapse("separate"))).toEqual({ borderCollapse: "separate" });
	});
});
