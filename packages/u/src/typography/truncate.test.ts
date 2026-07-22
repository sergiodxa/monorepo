/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { truncate } from "./truncate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("truncate", () => {
	test("applies the fixed single-line ellipsis overflow declaration", () => {
		expect(styles(truncate())).toEqual({
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		});
	});
});
