/**
 * Unit tests for `selection.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { selection } from "./selection";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("selection", () => {
	test("nests the input's styles under '&::selection'", () => {
		expect(styles(selection(bg("brand.solid")))).toEqual({
			"&::selection": { backgroundColor: "var(--ui-brand-bg-solid)" },
		});
	});
});
