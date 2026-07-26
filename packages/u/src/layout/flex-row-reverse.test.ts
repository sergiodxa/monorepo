/**
 * Unit tests for `flexRowReverse()`'s fixed `flex-direction: row-reverse`
 * declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { flexRowReverse } from "./flex-row-reverse";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("flexRowReverse", () => {
	test("sets display: flex and flex-direction: row-reverse", () => {
		expect(styles(flexRowReverse())).toEqual({
			display: "flex",
			flexDirection: "row-reverse",
		});
	});
});
