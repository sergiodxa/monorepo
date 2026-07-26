/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { outline } from "./outline";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("outline", () => {
	test("no-arg resolves the system default color, 2px solid, no offset", () => {
		expect(styles(outline())).toEqual({
			outlineColor: "var(--ui-ring, Highlight)",
			outlineWidth: "2px",
			outlineStyle: "solid",
		});
	});

	test("resolves an explicit color, width, style, and offset together", () => {
		expect(styles(outline({ color: "danger", width: 3, style: "dashed", offset: 4 }))).toEqual({
			outlineColor: "var(--ui-danger-ring)",
			outlineWidth: "3px",
			outlineStyle: "dashed",
			outlineOffset: "4px",
		});
	});

	test("a bare string sets the color", () => {
		expect(styles(outline("danger"))).toEqual({
			outlineColor: "var(--ui-danger-ring)",
			outlineWidth: "2px",
			outlineStyle: "solid",
		});
	});

	test("a bare number sets the width in pixels", () => {
		expect(styles(outline(4))).toEqual({
			outlineColor: "var(--ui-ring, Highlight)",
			outlineWidth: "4px",
			outlineStyle: "solid",
		});
	});

	test("a color and a width together set both", () => {
		expect(styles(outline("danger", 4))).toEqual({
			outlineColor: "var(--ui-danger-ring)",
			outlineWidth: "4px",
			outlineStyle: "solid",
		});
	});

	test("offset accepts a raw CSS length string", () => {
		let result = styles(outline({ offset: "0.25rem" }));
		expect(result.outlineOffset).toBe("0.25rem");
	});

	test("width and offset default to no unit only when given as a raw string", () => {
		expect(styles(outline({ width: "0.125rem" })).outlineWidth).toBe("0.125rem");
	});

	test("'none' short-circuits to a bare outline reset, not a color branch", () => {
		expect(styles(outline("none"))).toEqual({ outline: "none" });
	});
});
