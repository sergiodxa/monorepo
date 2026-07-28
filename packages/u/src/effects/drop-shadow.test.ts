/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_FILTER } from "../internal/filter";

import { dropShadow } from "./drop-shadow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("dropShadow", () => {
	test("no-arg resolves the default offsets off the spacing scale and a translucent black", () => {
		expect(styles(dropShadow())).toEqual({
			"--ui-filter-drop-shadow":
				"calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15)",
			filter: COMPOSITE_FILTER,
		});
	});

	test("raw CSS lengths pass through unchanged", () => {
		expect(styles(dropShadow({ x: "1px", y: "2px", blur: "4px" }))).toEqual({
			"--ui-filter-drop-shadow": "1px 2px 4px rgb(0 0 0 / 0.15)",
			filter: COMPOSITE_FILTER,
		});
	});

	test("a bare tone color resolves against the border property", () => {
		expect(styles(dropShadow({ x: "0", y: "0", blur: "0", color: "brand" }))).toEqual({
			"--ui-filter-drop-shadow": "0 0 0 var(--ui-brand-border)",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit color property is honored", () => {
		expect(styles(dropShadow({ x: "0", y: "1px", blur: "2px", color: "brand.solid" }))).toEqual({
			"--ui-filter-drop-shadow": "0 1px 2px var(--ui-brand-bg-solid)",
			filter: COMPOSITE_FILTER,
		});
	});
});
