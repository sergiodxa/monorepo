/**
 * Unit test for the shared `css()` style-object type in
 * {@link "./css-styles"}: a runtime check that a value built up from
 * separately-typed `CSSStyles` blocks — the pattern every animation factory
 * composing a nested selector or at-rule ahead of its own `css()` call relies
 * on — reaches `css()` with every nested block intact, so a change to the
 * underlying alias surfaces here instead of silently drifting from what
 * `css()` itself accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { CSSStyles } from "./css-styles";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("CSSStyles", () => {
	test("accepts a nested selector block built as its own separately-typed variable", () => {
		let hovered: CSSStyles = { opacity: 1 };
		let host: CSSStyles = { opacity: 0, "&:hover": hovered };

		expect(styles(css(host))["&:hover"]).toBe(hovered);
	});

	test("accepts an at-rule block nested at any depth", () => {
		let reduced: CSSStyles = { animationName: "none" };
		let host: CSSStyles = {
			animationName: "ui-spin-rotate",
			"@media (prefers-reduced-motion: reduce)": reduced,
		};

		expect(styles(css(host))["@media (prefers-reduced-motion: reduce)"]).toBe(reduced);
	});

	test("round-trips a plain declaration block through css() untouched", () => {
		let host: CSSStyles = { opacity: 0, transitionDuration: "150ms" };

		expect(styles(css(host))).toEqual(host);
	});
});
