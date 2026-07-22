/**
 * Unit tests for `appearance()`'s default and explicit `appearance` value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { appearance } from "./appearance";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("appearance", () => {
	test("defaults to none", () => {
		expect(styles(appearance())).toEqual({ appearance: "none" });
	});

	test("accepts an explicit value", () => {
		expect(styles(appearance("auto"))).toEqual({ appearance: "auto" });
	});
});
