/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_FILTER } from "../internal/filter.js";
import { declarations } from "../internal/serialize.js";

import { invert } from "./invert.js";

describe("invert", () => {
	test("no-arg defaults to a full inversion", async () => {
		expect(await declarations(invert())).toEqual([
			"--ui-filter-invert: 1",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit partial amount", async () => {
		expect(await declarations(invert(0.25))).toEqual([
			"--ui-filter-invert: 0.25",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit string amount passes through unchanged", async () => {
		expect(await declarations(invert("100%"))).toEqual([
			"--ui-filter-invert: 100%",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});
});
