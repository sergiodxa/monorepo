import type { CSSMixinDescriptor } from "remix/ui";

/**
 * Covers {@link semanticColorPanel} as pure `css()` output: the exact
 * `&[data-color="..."]` branch set a tinted panel's host composes into its
 * own `mix` array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { semanticColorPanel } from "./semantic-color-panel";

function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("semanticColorPanel", () => {
	test("emits one branch per semantic color", () => {
		expect(Object.keys(styles(semanticColorPanel())).sort()).toEqual(
			[
				'&[data-color="brand"]',
				'&[data-color="neutral"]',
				'&[data-color="success"]',
				'&[data-color="warning"]',
				'&[data-color="danger"]',
			].sort(),
		);
	});

	test("keys each branch to its matching data-color attribute selector and that color's variables", () => {
		let style = styles(semanticColorPanel());

		expect(style['&[data-color="neutral"]']).toEqual({
			borderColor: "var(--ui-neutral-border)",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			color: "var(--ui-neutral-fg-emphasis)",
		});
		expect(style['&[data-color="danger"]']).toEqual({
			borderColor: "var(--ui-danger-border)",
			backgroundColor: "var(--ui-danger-bg-tint)",
			color: "var(--ui-danger-fg-emphasis)",
		});
	});

	test("takes no options", () => {
		expect(semanticColorPanel.length).toBe(0);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(semanticColorPanel()).not.toBe(semanticColorPanel());
	});
});
