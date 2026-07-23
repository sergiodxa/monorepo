/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { tabularNums } from "./tabular-nums";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("tabularNums", () => {
	test("applies the fixed font-variant-numeric declaration", () => {
		expect(styles(tabularNums())).toEqual({ fontVariantNumeric: "tabular-nums" });
	});
});
