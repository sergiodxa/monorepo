/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { cursor } from "./cursor";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("cursor", () => {
	test("pointer", () => {
		expect(styles(cursor("pointer"))).toEqual({ cursor: "pointer" });
	});

	test("not-allowed", () => {
		expect(styles(cursor("not-allowed"))).toEqual({ cursor: "not-allowed" });
	});

	test("default", () => {
		expect(styles(cursor("default"))).toEqual({ cursor: "default" });
	});
});
