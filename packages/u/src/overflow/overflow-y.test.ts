/**
 * Unit tests for `overflowY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overflowY } from "./overflow-y";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("overflowY", () => {
	test("defaults to hidden", () => {
		expect(styles(overflowY())).toEqual({ overflowY: "hidden" });
	});

	test("accepts an explicit value", () => {
		expect(styles(overflowY("auto"))).toEqual({ overflowY: "auto" });
	});
});
