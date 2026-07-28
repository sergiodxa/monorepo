/**
 * Unit tests for `has.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { has } from "./has";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("has", () => {
	test("nests the input's styles under '&:has(selector)'", () => {
		expect(styles(has("img", p(4)))).toEqual({
			"&:has(img)": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("passes a compound selector through untouched", () => {
		expect(styles(has('[aria-selected="true"]', p(4)))).toEqual({
			'&:has([aria-selected="true"])': { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
