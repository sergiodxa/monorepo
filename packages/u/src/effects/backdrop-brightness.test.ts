/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { compose } from "../internal/descriptor";
import { declarations, serialize } from "../internal/serialize";

import { backdropBrightness } from "./backdrop-brightness";
import { backdropGrayscale } from "./backdrop-grayscale";
import { backdropHueRotate } from "./backdrop-hue-rotate";

describe("backdropBrightness", () => {
	test("no-arg defaults to 1.1", async () => {
		expect(await declarations(backdropBrightness())).toEqual([
			"--ui-backdrop-brightness: 1.1",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit numeric factor", async () => {
		expect(await declarations(backdropBrightness(0.8))).toEqual([
			"--ui-backdrop-brightness: 0.8",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit string factor passes through unchanged", async () => {
		expect(await declarations(backdropBrightness("80%"))).toEqual([
			"--ui-backdrop-brightness: 80%",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("applies unconditionally, with no prefers-reduced-transparency gating", async () => {
		expect(await serialize(backdropBrightness())).not.toContain("prefers-reduced-transparency");
	});
});

describe("composability with other backdrop utilities", () => {
	test("composing three backdrop utilities together sets all three variables under one composite backdrop-filter", async () => {
		let merged = compose(
			[backdropBrightness(), backdropGrayscale(), backdropHueRotate()],
			(styles) => styles,
		);

		expect(await declarations(merged)).toEqual([
			"--ui-backdrop-brightness: 1.1",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			"--ui-backdrop-grayscale: 1",
			"--ui-backdrop-hue-rotate: 90deg",
		]);
	});
});
