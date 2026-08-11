/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { leading } from "./leading";

describe("leading", () => {
	test("every named scale value resolves through the leading variable with its fallback", async () => {
		expect(await declarations(leading("none"))).toEqual(["line-height: var(--ui-leading-none, 1)"]);
		expect(await declarations(leading("tight"))).toEqual([
			"line-height: var(--ui-leading-tight, 1.25)",
		]);
		expect(await declarations(leading("snug"))).toEqual([
			"line-height: var(--ui-leading-snug, 1.375)",
		]);
		expect(await declarations(leading("normal"))).toEqual([
			"line-height: var(--ui-leading-normal, 1.5)",
		]);
		expect(await declarations(leading("relaxed"))).toEqual([
			"line-height: var(--ui-leading-relaxed, 1.625)",
		]);
		expect(await declarations(leading("loose"))).toEqual([
			"line-height: var(--ui-leading-loose, 2)",
		]);
	});

	test("a raw number passes through unchanged as a unitless multiplier", async () => {
		// `line-height` is one of the properties the serializer leaves unitless, so
		// a bare number survives as the ratio it was meant to be, not as `1.8px`.
		expect(await declarations(leading(1.8))).toEqual(["line-height: 1.8"]);
	});

	test("no-arg defaults to normal", async () => {
		expect(await declarations(leading())).toEqual(["line-height: var(--ui-leading-normal, 1.5)"]);
	});

	test("a raw CSS length passes through unchanged as a literal line-height", async () => {
		expect(await declarations(leading("16px"))).toEqual(["line-height: 16px"]);
		expect(await declarations(leading("2rem"))).toEqual(["line-height: 2rem"]);
	});
});
