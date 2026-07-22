/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { layer } from "./layer";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("layer", () => {
	test("merges isolate and z into one stacking-context-plus-order declaration", () => {
		expect(styles(layer(10))).toEqual({ isolation: "isolate", zIndex: 10 });
	});
});
