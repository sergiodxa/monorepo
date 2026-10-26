/**
 * Covers {@link fieldStackLayout} as pure `css()` output: the exact
 * single-column layout and its `0.5rem` gap, wide enough to clear a focus ring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor } from "remix/component";

import { describe, expect, test } from "vitest";

import { fieldStackLayout } from "./field-stack-layout.js";

function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("fieldStackLayout", () => {
	test("stacks children in a single column", () => {
		let style = styles(fieldStackLayout());

		expect(style.display).toBe("flex");
		expect(style.flexDirection).toBe("column");
	});

	test("carries a 0.5rem gap, so a focused control's ring clears its label", () => {
		expect(styles(fieldStackLayout()).gap).toBe("0.5rem");
	});

	test("carries exactly these three properties, nothing more", () => {
		expect(Object.keys(styles(fieldStackLayout())).sort()).toEqual(
			["display", "flexDirection", "gap"].sort(),
		);
	});

	test("returns a fresh css() mixin on every call", () => {
		expect(fieldStackLayout()).not.toBe(fieldStackLayout());
	});
});
