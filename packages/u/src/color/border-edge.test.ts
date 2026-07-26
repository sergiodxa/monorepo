/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { borderEdge } from "./border-edge";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("borderEdge", () => {
	test("a numeric width defaults style to solid, on the inline-start edge", () => {
		expect(styles(borderEdge("inline-start", { width: 1 }))).toEqual({
			borderInlineStartWidth: "1px",
			borderInlineStartStyle: "solid",
		});
	});

	test("the inline-end edge", () => {
		expect(styles(borderEdge("inline-end", { width: 1 }))).toEqual({
			borderInlineEndWidth: "1px",
			borderInlineEndStyle: "solid",
		});
	});

	test("an explicit style overrides the solid default", () => {
		expect(styles(borderEdge("block-start", { width: 1, style: "dashed" }))).toEqual({
			borderBlockStartWidth: "1px",
			borderBlockStartStyle: "dashed",
		});
	});

	test("a color resolves through the border property alias", () => {
		expect(styles(borderEdge("block-end", { color: "brand" }))).toEqual({
			borderBlockEndColor: "var(--ui-brand-border)",
		});
	});

	test("only sets the given keys", () => {
		expect(styles(borderEdge("inline-start", {}))).toEqual({});
	});

	test("accepts a physical edge, pinned regardless of writing mode", () => {
		expect(styles(borderEdge("right", { width: 1, style: "solid", color: "neutral" }))).toEqual({
			borderRightWidth: "1px",
			borderRightStyle: "solid",
			borderRightColor: "var(--ui-neutral-border)",
		});
	});

	test("width alone still defaults style to solid when noStyleDefault is absent", () => {
		expect(styles(borderEdge("inline-start", { width: 2 }))).toEqual({
			borderInlineStartWidth: "2px",
			borderInlineStartStyle: "solid",
		});
	});

	test("noStyleDefault suppresses the solid default, leaving width-only output", () => {
		expect(styles(borderEdge("inline-start", { width: 2, noStyleDefault: true }))).toEqual({
			borderInlineStartWidth: "2px",
		});
	});

	test("noStyleDefault has no effect when style is also given explicitly", () => {
		expect(
			styles(borderEdge("block-start", { width: 2, style: "dashed", noStyleDefault: true })),
		).toEqual({
			borderBlockStartWidth: "2px",
			borderBlockStartStyle: "dashed",
		});
	});
});
