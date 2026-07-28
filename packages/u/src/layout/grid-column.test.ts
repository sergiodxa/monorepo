/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { gridColumn } from "./grid-column";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("gridColumn", () => {
	test("emits a bare number as a line number, unchanged", () => {
		expect(styles(gridColumn(2))).toEqual({ gridColumn: 2 });
	});

	test("emits a negative line number unchanged", () => {
		expect(styles(gridColumn(-1))).toEqual({ gridColumn: -1 });
	});

	test("emits an explicit span", () => {
		expect(styles(gridColumn("span 2"))).toEqual({ gridColumn: "span 2" });
	});

	test("emits a start/end pair", () => {
		expect(styles(gridColumn("1 / 3"))).toEqual({ gridColumn: "1 / 3" });
	});

	test("emits a mixed span/line pair", () => {
		expect(styles(gridColumn("span 2 / -1"))).toEqual({ gridColumn: "span 2 / -1" });
	});

	test("emits named grid lines", () => {
		expect(styles(gridColumn("main-start / main-end"))).toEqual({
			gridColumn: "main-start / main-end",
		});
	});
});
