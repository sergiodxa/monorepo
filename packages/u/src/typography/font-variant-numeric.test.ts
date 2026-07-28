/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fontVariantNumeric } from "./font-variant-numeric";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fontVariantNumeric", () => {
	test("no-arg defaults to tabular-nums", () => {
		expect(styles(fontVariantNumeric())).toEqual({ fontVariantNumeric: "tabular-nums" });
	});

	test("normal", () => {
		expect(styles(fontVariantNumeric("normal"))).toEqual({ fontVariantNumeric: "normal" });
	});

	test("ordinal", () => {
		expect(styles(fontVariantNumeric("ordinal"))).toEqual({ fontVariantNumeric: "ordinal" });
	});

	test("slashed-zero", () => {
		expect(styles(fontVariantNumeric("slashed-zero"))).toEqual({
			fontVariantNumeric: "slashed-zero",
		});
	});

	test("lining-nums", () => {
		expect(styles(fontVariantNumeric("lining-nums"))).toEqual({
			fontVariantNumeric: "lining-nums",
		});
	});

	test("oldstyle-nums", () => {
		expect(styles(fontVariantNumeric("oldstyle-nums"))).toEqual({
			fontVariantNumeric: "oldstyle-nums",
		});
	});

	test("proportional-nums", () => {
		expect(styles(fontVariantNumeric("proportional-nums"))).toEqual({
			fontVariantNumeric: "proportional-nums",
		});
	});

	test("tabular-nums", () => {
		expect(styles(fontVariantNumeric("tabular-nums"))).toEqual({
			fontVariantNumeric: "tabular-nums",
		});
	});

	test("diagonal-fractions", () => {
		expect(styles(fontVariantNumeric("diagonal-fractions"))).toEqual({
			fontVariantNumeric: "diagonal-fractions",
		});
	});

	test("stacked-fractions", () => {
		expect(styles(fontVariantNumeric("stacked-fractions"))).toEqual({
			fontVariantNumeric: "stacked-fractions",
		});
	});

	test("raw string passes a space-separated combination through", () => {
		expect(styles(fontVariantNumeric("tabular-nums slashed-zero"))).toEqual({
			fontVariantNumeric: "tabular-nums slashed-zero",
		});
	});
});
