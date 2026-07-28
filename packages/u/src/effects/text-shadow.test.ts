/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { textShadow } from "./text-shadow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("textShadow", () => {
	test("no-arg resolves the default offsets off the spacing scale and a translucent black", () => {
		expect(styles(textShadow())).toEqual({
			textShadow:
				"calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.35)",
		});
	});

	test("raw CSS lengths pass through unchanged", () => {
		expect(styles(textShadow({ x: "1px", y: "2px", blur: "4px" }))).toEqual({
			textShadow: "1px 2px 4px rgb(0 0 0 / 0.35)",
		});
	});

	test("a bare tone color resolves against the border property", () => {
		expect(styles(textShadow({ x: "0", y: "0", blur: "0", color: "brand" }))).toEqual({
			textShadow: "0 0 0 var(--ui-brand-border)",
		});
	});

	test("an explicit color property is honored", () => {
		expect(styles(textShadow({ x: "0", y: "1px", blur: "2px", color: "brand.solid" }))).toEqual({
			textShadow: "0 1px 2px var(--ui-brand-bg-solid)",
		});
	});

	test("sets only text-shadow, unlike its filter-based neighbour", () => {
		expect(Object.keys(styles(textShadow()) as Record<string, unknown>)).toEqual(["textShadow"]);
	});
});
