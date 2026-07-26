/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { virtualize } from "./virtualize";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("virtualize", () => {
	test("applies content-visibility with the given intrinsic size fallback", () => {
		expect(styles(virtualize("auto var(--ui-table-row-size, 2.5rem)"))).toEqual({
			contentVisibility: "auto",
			containIntrinsicSize: "auto var(--ui-table-row-size, 2.5rem)",
		});
	});
});
