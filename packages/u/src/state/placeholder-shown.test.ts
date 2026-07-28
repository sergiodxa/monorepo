/**
 * Unit tests for `placeholder-shown.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { placeholderShown } from "./placeholder-shown";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("placeholderShown", () => {
	test("nests the input's styles under '&:placeholder-shown'", () => {
		expect(styles(placeholderShown(p(4)))).toEqual({
			"&:placeholder-shown": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
