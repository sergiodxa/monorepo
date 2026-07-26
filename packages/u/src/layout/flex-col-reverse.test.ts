/**
 * Unit tests for `flexColReverse()`'s fixed `flex-direction: column-reverse`
 * declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { flexColReverse } from "./flex-col-reverse";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("flexColReverse", () => {
	test("sets display: flex and flex-direction: column-reverse", () => {
		expect(styles(flexColReverse())).toEqual({
			display: "flex",
			flexDirection: "column-reverse",
		});
	});
});
