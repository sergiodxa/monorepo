/**
 * Covers {@link fieldStackLayout} as pure `css()` output: the exact
 * single-column layout and its `0.25rem` gap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor } from "remix/ui";

import { describe, expect, test } from "vitest";

import { fieldStackLayout } from "./field-stack-layout";

function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("fieldStackLayout", () => {
	test("stacks children in a single column", () => {
		let style = styles(fieldStackLayout());

		expect(style.display).toBe("flex");
		expect(style.flexDirection).toBe("column");
	});

	test("carries a small 0.25rem gap between stacked children", () => {
		expect(styles(fieldStackLayout()).gap).toBe("0.25rem");
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
