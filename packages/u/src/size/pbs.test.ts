/**
 * Unit tests for `pbs()`'s `padding-block-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { pbs } from "./pbs";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("pbs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(pbs(4))).toEqual({
			paddingBlockStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});
