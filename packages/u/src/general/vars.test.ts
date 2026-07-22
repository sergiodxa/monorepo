/**
 * Unit tests for `vars.ts`'s custom-property utility.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { vars } from "./vars";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("vars", () => {
	test("prefixes a single key with '--'", () => {
		expect(styles(vars({ "sidebar-width": "18rem" }))).toEqual({
			"--sidebar-width": "18rem",
		});
	});

	test("prefixes every key when given multiple entries", () => {
		expect(styles(vars({ "sidebar-width": "18rem", "header-height": "4rem" }))).toEqual({
			"--sidebar-width": "18rem",
			"--header-height": "4rem",
		});
	});

	test("passes numeric values through unchanged", () => {
		expect(styles(vars({ "z-index": 10 }))).toEqual({
			"--z-index": 10,
		});
	});
});
