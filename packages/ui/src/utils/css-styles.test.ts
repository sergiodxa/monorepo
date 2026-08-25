/**
 * Unit test for the shared `css()` style-object type in
 * {@link "./css-styles"}: confirms a value built from separately-typed
 * `CSSStyles` blocks reaches `css()` with every nested block intact, so a
 * change to the underlying alias surfaces here directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor } from "remix/ui";

import { css } from "remix/ui";
import { describe, expect, test } from "vitest";

import type { CSSStyles } from "./css-styles";

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
