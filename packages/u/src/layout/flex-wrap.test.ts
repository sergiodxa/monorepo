/**
 * Unit tests for `flexWrap()`'s default and explicit `flex-wrap` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { flexWrap } from "./flex-wrap";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("flexWrap", () => {
	test("defaults to wrap", () => {
		expect(styles(flexWrap())).toEqual({ flexWrap: "wrap" });
	});

	test("accepts wrap explicitly", () => {
		expect(styles(flexWrap("wrap"))).toEqual({ flexWrap: "wrap" });
	});

	test("accepts nowrap", () => {
		expect(styles(flexWrap("nowrap"))).toEqual({ flexWrap: "nowrap" });
	});

	test("accepts wrap-reverse", () => {
		expect(styles(flexWrap("wrap-reverse"))).toEqual({ flexWrap: "wrap-reverse" });
	});
});
