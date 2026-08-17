/**
 * Unit tests for the shared filter-composability foundation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_FILTER, filterFunction } from "./filter";
import { declarations } from "./serialize";

describe("filterFunction", () => {
	test("sets the given custom property plus the shared composite filter value", async () => {
		expect(await declarations(filterFunction({ blur: "12px" }))).toEqual([
			"--ui-filter-blur: 12px",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("sets multiple custom properties in one call", async () => {
		expect(await declarations(filterFunction({ blur: "12px", grayscale: "1" }))).toEqual([
			"--ui-filter-blur: 12px",
			"--ui-filter-grayscale: 1",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("the drop-shadow function reads a dash-cased variable from its camel-cased key", async () => {
		expect(
			await declarations(filterFunction({ dropShadow: "0 1px 2px rgb(0 0 0 / 0.15)" })),
		).toEqual([
			"--ui-filter-drop-shadow: 0 1px 2px rgb(0 0 0 / 0.15)",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("the hue-rotate function reads a dash-cased variable from its camel-cased key", async () => {
		expect(await declarations(filterFunction({ hueRotate: "90deg" }))).toEqual([
			"--ui-filter-hue-rotate: 90deg",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("the opacity filter function writes its own variable, not the opacity property", async () => {
		let result = await declarations(filterFunction({ opacity: "0.5" }));

		expect(result).toEqual(["--ui-filter-opacity: 0.5", `filter: ${COMPOSITE_FILTER}`]);
		expect(result).not.toContain("opacity: 0.5");
	});

	test("every filter function's variable appears in the composite with an identity fallback", () => {
		expect(COMPOSITE_FILTER).toContain("blur(var(--ui-filter-blur, 0px))");
		expect(COMPOSITE_FILTER).toContain("brightness(var(--ui-filter-brightness, 1))");
		expect(COMPOSITE_FILTER).toContain("contrast(var(--ui-filter-contrast, 1))");
		expect(COMPOSITE_FILTER).toContain("grayscale(var(--ui-filter-grayscale, 0))");
		expect(COMPOSITE_FILTER).toContain("hue-rotate(var(--ui-filter-hue-rotate, 0deg))");
		expect(COMPOSITE_FILTER).toContain("invert(var(--ui-filter-invert, 0))");
		expect(COMPOSITE_FILTER).toContain("opacity(var(--ui-filter-opacity, 1))");
		expect(COMPOSITE_FILTER).toContain("saturate(var(--ui-filter-saturate, 1))");
		expect(COMPOSITE_FILTER).toContain("sepia(var(--ui-filter-sepia, 0))");
		expect(COMPOSITE_FILTER).toContain(
			"drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent))",
		);
	});

	test("the composite carries all ten CSS filter functions, in the order CSS applies them", () => {
		expect(COMPOSITE_FILTER).toBe(
			[
				"blur(var(--ui-filter-blur, 0px))",
				"brightness(var(--ui-filter-brightness, 1))",
				"contrast(var(--ui-filter-contrast, 1))",
				"grayscale(var(--ui-filter-grayscale, 0))",
				"hue-rotate(var(--ui-filter-hue-rotate, 0deg))",
				"invert(var(--ui-filter-invert, 0))",
				"opacity(var(--ui-filter-opacity, 1))",
				"saturate(var(--ui-filter-saturate, 1))",
				"sepia(var(--ui-filter-sepia, 0))",
				"drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent))",
			].join(" "),
		);
	});

	test("the composite's function order is fixed, so composition is order-independent at the call site", async () => {
		let blurFirst = await declarations(filterFunction({ blur: "4px", grayscale: "1" }));
		let grayscaleFirst = await declarations(filterFunction({ grayscale: "1", blur: "4px" }));

		expect(blurFirst.filter((line) => line.startsWith("filter:"))).toEqual(
			grayscaleFirst.filter((line) => line.startsWith("filter:")),
		);
	});
});
