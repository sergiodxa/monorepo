/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { declarations } from "../internal/serialize";

import { backdropContrast } from "./backdrop-contrast";

describe("backdropContrast", () => {
	test("no-arg defaults to 1.25", async () => {
		expect(await declarations(backdropContrast())).toEqual([
			"--ui-backdrop-contrast: 1.25",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit numeric factor", async () => {
		expect(await declarations(backdropContrast(0.75))).toEqual([
			"--ui-backdrop-contrast: 0.75",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit string factor passes through unchanged", async () => {
		expect(await declarations(backdropContrast("125%"))).toEqual([
			"--ui-backdrop-contrast: 125%",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
