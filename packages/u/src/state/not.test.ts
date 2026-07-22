/**
 * Unit tests for `not.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { not } from "./not";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("not", () => {
	test("wraps the selector in ':not(...)' and nests the input's styles there", () => {
		expect(styles(not(":disabled", p(4)))).toEqual({
			"&:not(:disabled)": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
