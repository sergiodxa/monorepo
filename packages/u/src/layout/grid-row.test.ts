/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { gridRow } from "./grid-row";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("gridRow", () => {
	test("emits a bare number as a line number, unchanged", () => {
		expect(styles(gridRow(2))).toEqual({ gridRow: 2 });
	});

	test("emits a negative line number unchanged", () => {
		expect(styles(gridRow(-1))).toEqual({ gridRow: -1 });
	});

	test("emits an explicit span", () => {
		expect(styles(gridRow("span 3"))).toEqual({ gridRow: "span 3" });
	});

	test("emits a start/end pair", () => {
		expect(styles(gridRow("1 / -1"))).toEqual({ gridRow: "1 / -1" });
	});

	test("emits named grid lines", () => {
		expect(styles(gridRow("header-start / header-end"))).toEqual({
			gridRow: "header-start / header-end",
		});
	});
});
