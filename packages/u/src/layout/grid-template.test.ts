/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { gridTemplate } from "./grid-template";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("gridTemplate", () => {
	test("no-arg sets nothing", () => {
		expect(styles(gridTemplate())).toEqual({});
	});

	test("columns alone", () => {
		expect(styles(gridTemplate({ columns: "1fr 2fr" }))).toEqual({
			gridTemplateColumns: "1fr 2fr",
		});
	});

	test("rows alone", () => {
		expect(styles(gridTemplate({ rows: "auto 1fr" }))).toEqual({
			gridTemplateRows: "auto 1fr",
		});
	});

	test("areas alone", () => {
		expect(styles(gridTemplate({ areas: '"header header" "sidebar main"' }))).toEqual({
			gridTemplateAreas: '"header header" "sidebar main"',
		});
	});

	test("columns and rows together", () => {
		expect(styles(gridTemplate({ columns: "1fr 2fr", rows: "auto 1fr" }))).toEqual({
			gridTemplateColumns: "1fr 2fr",
			gridTemplateRows: "auto 1fr",
		});
	});

	test("all three keys together", () => {
		expect(
			styles(
				gridTemplate({
					columns: "1fr 1fr",
					rows: "auto",
					areas: '"a b"',
				}),
			),
		).toEqual({
			gridTemplateColumns: "1fr 1fr",
			gridTemplateRows: "auto",
			gridTemplateAreas: '"a b"',
		});
	});
});
