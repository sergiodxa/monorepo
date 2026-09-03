/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter.js";
import { declarations } from "../internal/serialize.js";

import { backdropInvert } from "./backdrop-invert.js";

describe("backdropInvert", () => {
	test("no-arg defaults to 1", async () => {
		expect(await declarations(backdropInvert())).toEqual([
			"--ui-backdrop-invert: 1",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit partial amount", async () => {
		expect(await declarations(backdropInvert(0.15))).toEqual([
			"--ui-backdrop-invert: 0.15",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit string amount passes through unchanged", async () => {
		expect(await declarations(backdropInvert("15%"))).toEqual([
			"--ui-backdrop-invert: 15%",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
