/**
 * Unit tests for `open.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { open } from "./open";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("open", () => {
	test("nests the wrapped utility's styles under '&[open], &:popover-open'", () => {
		expect(styles(open(p(4)))).toEqual({
			"&[open], &:popover-open": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
