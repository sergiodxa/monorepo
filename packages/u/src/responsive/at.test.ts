/**
 * Unit tests for `at.ts`, the container-query wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { at } from "./at";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("at", () => {
	test("nests the wrapped utility's styles under a container query for a known name", () => {
		expect(styles(at("md", p(4)))).toEqual({
			"@container (min-width: 36rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});

	test("resolves a named step to a literal length, never a var() reference", () => {
		for (let size of ["xs", "sm", "md", "lg", "xl", "2xl"] as const) {
			expect(Object.keys(styles(at(size, p(4))))[0]).not.toInclude("var(");
		}
	});

	test("falls back to the md length for an unrecognized name", () => {
		expect(styles(at("made-up", p(4)))).toEqual({
			"@container (min-width: 36rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});

	test("a third argument targets a specific named container instead of the nearest one", () => {
		expect(styles(at("md", "sidebar", p(4)))).toEqual({
			"@container sidebar (min-width: 36rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});

	test("a literal CSS length is used as-is, not wrapped in a var() token reference", () => {
		expect(styles(at("40rem", p(4)))).toEqual({
			"@container (min-width: 40rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});

	test("a literal length still composes with a named container target", () => {
		expect(styles(at("40rem", "ui-dialog", p(4)))).toEqual({
			"@container ui-dialog (min-width: 40rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});
});
