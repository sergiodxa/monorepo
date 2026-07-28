/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { gridAutoFlow } from "./grid-auto-flow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("gridAutoFlow", () => {
	test("defaults to row", () => {
		expect(styles(gridAutoFlow())).toEqual({ gridAutoFlow: "row" });
	});

	test("'column'", () => {
		expect(styles(gridAutoFlow("column"))).toEqual({ gridAutoFlow: "column" });
	});

	test("'dense'", () => {
		expect(styles(gridAutoFlow("dense"))).toEqual({ gridAutoFlow: "dense" });
	});

	test("'row dense'", () => {
		expect(styles(gridAutoFlow("row dense"))).toEqual({ gridAutoFlow: "row dense" });
	});

	test("'column dense'", () => {
		expect(styles(gridAutoFlow("column dense"))).toEqual({ gridAutoFlow: "column dense" });
	});
});
