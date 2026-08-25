import type { CSSMixinDescriptor } from "remix/ui";

/**
 * Covers {@link panelChrome} as pure `css()` output: the exact property set
 * and values a framed panel's host composes into its own `mix` array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { panelChrome } from "./panel-chrome";

function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("panelChrome", () => {
	test("is a large, rounded, solid 1px neutral border", () => {
		expect(styles(panelChrome())).toEqual({
			borderRadius: "var(--ui-radius-lg, 0.5rem)",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--ui-neutral-border)",
		});
	});

	test("carries exactly the four border properties, nothing else", () => {
		expect(Object.keys(styles(panelChrome())).sort()).toEqual(
			["borderColor", "borderRadius", "borderStyle", "borderWidth"].sort(),
		);
	});

	test("takes no options", () => {
		expect(panelChrome.length).toBe(0);
	});
});
