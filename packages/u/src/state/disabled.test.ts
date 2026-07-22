/**
 * Unit tests for `disabled.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { disabled } from "./disabled";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("disabled", () => {
	test("nests the wrapped utility's styles under '&:disabled, &[aria-disabled=\"true\"]'", () => {
		expect(styles(disabled(p(4)))).toEqual({
			'&:disabled, &[aria-disabled="true"]': { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
