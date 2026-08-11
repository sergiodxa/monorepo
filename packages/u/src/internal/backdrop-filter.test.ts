/**
 * Unit tests for the shared backdrop-filter-composability foundation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { backdropFilterFunction, COMPOSITE_BACKDROP_FILTER } from "./backdrop-filter";
import { declarations } from "./serialize";

describe("backdropFilterFunction", () => {
	test("sets the given custom property plus the shared composite backdropFilter value, on both the standard and Webkit-prefixed properties", async () => {
		// The prefixed key only reaches Safari as `-webkit-backdrop-filter` if
		// it keeps its leading dash; a lowercase `webkit…` spelling would
		// kebab-case to a property no browser knows.
		expect(await declarations(backdropFilterFunction({ blur: "12px" }))).toEqual([
			"--ui-backdrop-blur: 12px",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("sets multiple custom properties in one call", async () => {
		expect(await declarations(backdropFilterFunction({ blur: "12px", saturate: "1.4" }))).toEqual([
			"--ui-backdrop-blur: 12px",
			"--ui-backdrop-saturate: 1.4",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("the hue-rotate function reads a dash-cased variable from its camel-cased key", async () => {
		expect(await declarations(backdropFilterFunction({ hueRotate: "90deg" }))).toEqual([
			"--ui-backdrop-hue-rotate: 90deg",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("every backdrop-filter function's variable appears in the composite with an identity fallback", () => {
		expect(COMPOSITE_BACKDROP_FILTER).toContain("blur(var(--ui-backdrop-blur, 0px))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("brightness(var(--ui-backdrop-brightness, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("contrast(var(--ui-backdrop-contrast, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("grayscale(var(--ui-backdrop-grayscale, 0))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("invert(var(--ui-backdrop-invert, 0))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("opacity(var(--ui-backdrop-opacity, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("saturate(var(--ui-backdrop-saturate, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("sepia(var(--ui-backdrop-sepia, 0))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain(
			"drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))",
		);
	});

	test("the composite's function order matches the filter composite's", () => {
		expect(COMPOSITE_BACKDROP_FILTER).toBe(
			[
				"blur(var(--ui-backdrop-blur, 0px))",
				"brightness(var(--ui-backdrop-brightness, 1))",
				"contrast(var(--ui-backdrop-contrast, 1))",
				"grayscale(var(--ui-backdrop-grayscale, 0))",
				"hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))",
				"invert(var(--ui-backdrop-invert, 0))",
				"opacity(var(--ui-backdrop-opacity, 1))",
				"saturate(var(--ui-backdrop-saturate, 1))",
				"sepia(var(--ui-backdrop-sepia, 0))",
				"drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))",
			].join(" "),
		);
	});

	test("the composite's function order is fixed, so composition is order-independent at the call site", async () => {
		let blurFirst = await declarations(backdropFilterFunction({ blur: "4px", sepia: "1" }));
		let sepiaFirst = await declarations(backdropFilterFunction({ sepia: "1", blur: "4px" }));

		expect(blurFirst.filter((line) => line.startsWith("backdrop-filter:"))).toEqual(
			sepiaFirst.filter((line) => line.startsWith("backdrop-filter:")),
		);
	});
});
