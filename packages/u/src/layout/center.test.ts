/**
 * Unit tests for `center()`'s fixed three-property centering declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { center } from "./center";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("center", () => {
	test("sets display: flex with both axes centered", () => {
		expect(styles(center())).toEqual({
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		});
	});
});
