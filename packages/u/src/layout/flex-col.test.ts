/**
 * Unit tests for `flexCol()`'s fixed `flex-direction: column` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { flexCol } from "./flex-col";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("flexCol", () => {
	test("sets flex-direction: column", () => {
		expect(styles(flexCol())).toEqual({ flexDirection: "column" });
	});
});
