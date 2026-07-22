/**
 * Unit tests for `flexRow()`'s fixed `flex-direction: row` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { flexRow } from "./flex-row";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("flexRow", () => {
	test("sets flex-direction: row", () => {
		expect(styles(flexRow())).toEqual({ flexDirection: "row" });
	});
});
