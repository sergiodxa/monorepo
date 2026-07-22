/**
 * Unit tests for `when.ts`, the primitive selector wrapper every other state
 * utility is sugar over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { p } from "../size/p";

import { when } from "./when";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("when", () => {
	test("nests a single utility's styles under the literal selector", () => {
		expect(styles(when("&:hover", p(4)))).toEqual({
			"&:hover": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("nests an array of two utilities, merged under the same selector", () => {
		expect(styles(when("&:hover", [bg("brand.tint"), border("brand")]))).toEqual({
			"&:hover": {
				backgroundColor: "var(--ui-brand-bg-tint)",
				borderColor: "var(--ui-brand-border)",
			},
		});
	});
});
