/**
 * Covers {@link focusRingPrimary} and {@link focusRingByColor} as pure
 * `css()` output: the exact property set, values, and selector every
 * focus-visible ring composes into its own host `mix` array, plus the
 * semantic color branches `focusRingByColor` layers on top of the shared
 * primary ring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { focusRingByColor, focusRingPrimary } from "./focus-ring";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("focusRingPrimary", () => {
	test("declares the ring under the default focus-visible selector", () => {
		expect(styles(focusRingPrimary())).toEqual({
			"&:focus-visible": {
				outlineWidth: "2px",
				outlineStyle: "solid",
				outlineOffset: "2px",
				outlineColor: "var(--ui-primary-ring)",
			},
		});
	});

	test("carries exactly the four ring properties, nothing else", () => {
		let declaration = styles(focusRingPrimary())["&:focus-visible"] as Record<string, unknown>;

		expect(Object.keys(declaration).sort()).toEqual(
			["outlineColor", "outlineOffset", "outlineStyle", "outlineWidth"].sort(),
		);
	});

	test("declares the same ring under a custom `when` selector instead", () => {
		expect(styles(focusRingPrimary({ when: "&:has(:focus-visible)" }))).toEqual({
			"&:has(:focus-visible)": {
				outlineWidth: "2px",
				outlineStyle: "solid",
				outlineOffset: "2px",
				outlineColor: "var(--ui-primary-ring)",
			},
		});
	});

	test("reads its color through the shared primary ring variable rather than a bare literal", () => {
		let declaration = styles(focusRingPrimary())["&:focus-visible"] as Record<string, unknown>;

		expect(declaration.outlineColor).toBe("var(--ui-primary-ring)");
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(focusRingPrimary()).not.toBe(focusRingPrimary());
	});
});

describe("focusRingByColor", () => {
	test("carries the same base outline as focusRingPrimary under the default selector", () => {
		let declaration = styles(focusRingByColor())["&:focus-visible"] as Record<string, unknown>;

		expect(declaration).toMatchObject({
			outlineWidth: "2px",
			outlineStyle: "solid",
			outlineOffset: "2px",
			outlineColor: "var(--ui-primary-ring)",
		});
	});

	test("overrides the outline color for each remaining semantic color role", () => {
		let declaration = styles(focusRingByColor())["&:focus-visible"] as Record<string, unknown>;

		expect(declaration).toMatchObject({
			'&[data-color="neutral"]': { outlineColor: "var(--ui-neutral-ring)" },
			'&[data-color="success"]': { outlineColor: "var(--ui-success-ring)" },
			'&[data-color="warning"]': { outlineColor: "var(--ui-warning-ring)" },
			'&[data-color="danger"]': { outlineColor: "var(--ui-danger-ring)" },
		});
	});

	test("carries exactly the four outline properties plus one override per remaining color, nothing else", () => {
		let declaration = styles(focusRingByColor())["&:focus-visible"] as Record<string, unknown>;

		expect(Object.keys(declaration).sort()).toEqual(
			[
				"outlineColor",
				"outlineOffset",
				"outlineStyle",
				"outlineWidth",
				'&[data-color="neutral"]',
				'&[data-color="success"]',
				'&[data-color="warning"]',
				'&[data-color="danger"]',
			].sort(),
		);
	});

	test("declares the same ring under a custom when selector instead of the default", () => {
		let style = styles(focusRingByColor({ when: "&:has(input:focus-visible)" }));
		let declaration = style["&:has(input:focus-visible)"] as Record<string, unknown>;

		expect(declaration).toMatchObject({ outlineColor: "var(--ui-primary-ring)" });
		expect(style["&:focus-visible"]).toBeUndefined();
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(focusRingByColor()).not.toBe(focusRingByColor());
	});
});
