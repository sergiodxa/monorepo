/**
 * Unit tests for `before.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { before } from "./before";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("before", () => {
	test("nests the input's styles under '&::before'", () => {
		expect(styles(before(p(4)))).toEqual({
			"&::before": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
