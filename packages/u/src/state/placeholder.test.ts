/**
 * Unit tests for `placeholder.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { placeholder } from "./placeholder";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("placeholder", () => {
	test("nests the input's styles under '&::placeholder'", () => {
		expect(styles(placeholder(p(4)))).toEqual({
			"&::placeholder": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
