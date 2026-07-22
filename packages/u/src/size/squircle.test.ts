/**
 * Unit tests for `squircle()`'s composition of a radius declaration with the
 * `corner()` progressive-enhancement wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { squircle } from "./squircle";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("squircle", () => {
	test("defaults to the 'md' radius, alongside the @supports corner-shape block", () => {
		expect(styles(squircle())).toEqual({
			borderRadius: "var(--ui-radius-md, 0.375rem)",
			"@supports (corner-shape: squircle)": { cornerShape: "squircle" },
		});
	});

	test("resolves an explicit radius name, alongside the @supports corner-shape block", () => {
		expect(styles(squircle("lg"))).toEqual({
			borderRadius: "var(--ui-radius-lg, 0.5rem)",
			"@supports (corner-shape: squircle)": { cornerShape: "squircle" },
		});
	});
});
