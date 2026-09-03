/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { fontVariantNumeric } from "./font-variant-numeric.js";

describe("fontVariantNumeric", () => {
	test("no-arg defaults to tabular-nums", async () => {
		expect(await declarations(fontVariantNumeric())).toEqual([
			"font-variant-numeric: tabular-nums",
		]);
	});

	test("normal", async () => {
		expect(await declarations(fontVariantNumeric("normal"))).toEqual([
			"font-variant-numeric: normal",
		]);
	});

	test("ordinal", async () => {
		expect(await declarations(fontVariantNumeric("ordinal"))).toEqual([
			"font-variant-numeric: ordinal",
		]);
	});

	test("slashed-zero", async () => {
		expect(await declarations(fontVariantNumeric("slashed-zero"))).toEqual([
			"font-variant-numeric: slashed-zero",
		]);
	});

	test("lining-nums", async () => {
		expect(await declarations(fontVariantNumeric("lining-nums"))).toEqual([
			"font-variant-numeric: lining-nums",
		]);
	});

	test("oldstyle-nums", async () => {
		expect(await declarations(fontVariantNumeric("oldstyle-nums"))).toEqual([
			"font-variant-numeric: oldstyle-nums",
		]);
	});

	test("proportional-nums", async () => {
		expect(await declarations(fontVariantNumeric("proportional-nums"))).toEqual([
			"font-variant-numeric: proportional-nums",
		]);
	});

	test("tabular-nums", async () => {
		expect(await declarations(fontVariantNumeric("tabular-nums"))).toEqual([
			"font-variant-numeric: tabular-nums",
		]);
	});

	test("diagonal-fractions", async () => {
		expect(await declarations(fontVariantNumeric("diagonal-fractions"))).toEqual([
			"font-variant-numeric: diagonal-fractions",
		]);
	});

	test("stacked-fractions", async () => {
		expect(await declarations(fontVariantNumeric("stacked-fractions"))).toEqual([
			"font-variant-numeric: stacked-fractions",
		]);
	});

	test("raw string passes a space-separated combination through", async () => {
		expect(await declarations(fontVariantNumeric("tabular-nums slashed-zero"))).toEqual([
			"font-variant-numeric: tabular-nums slashed-zero",
		]);
	});
});
