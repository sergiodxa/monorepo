/**
 * Unit tests for `at-max.ts`, the max-width container-query wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { atMax } from "./at";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("atMax", () => {
	test("nests the wrapped utility's styles under a max-width container query for a known name", () => {
		expect(styles(atMax("md", p(4)))).toEqual({
			"@container (max-width: 36rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});

	test("resolves a named step to a literal length, never a var() reference", () => {
		expect(Object.keys(styles(atMax("lg", p(4))))[0]).not.toInclude("var(");
	});

	test("a literal CSS length is used as-is, not wrapped in a var() token reference", () => {
		expect(styles(atMax("40rem", p(4)))).toEqual({
			"@container (max-width: 40rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});

	test("a third argument targets a specific named container instead of the nearest one", () => {
		expect(styles(atMax("md", "sidebar", p(4)))).toEqual({
			"@container sidebar (max-width: 36rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});
});
