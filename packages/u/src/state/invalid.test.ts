/**
 * Unit tests for `invalid.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { border } from "../color/border";

import { invalid } from "./invalid";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("invalid", () => {
	test("nests the wrapped utility's styles under '&:user-invalid, &[aria-invalid=\"true\"]'", () => {
		expect(styles(invalid(border("danger")))).toEqual({
			'&:user-invalid, &[aria-invalid="true"]': { borderColor: "var(--ui-danger-border)" },
		});
	});
});
