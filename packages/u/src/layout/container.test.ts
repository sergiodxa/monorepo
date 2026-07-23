/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { container } from "./container";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("container", () => {
	test("defaults to an inline-size container type", () => {
		expect(styles(container("sidebar"))).toEqual({ container: "sidebar / inline-size" });
	});

	test("an explicit container type", () => {
		expect(styles(container("sidebar", "size"))).toEqual({ container: "sidebar / size" });
	});
});
